import { describe, it, expect, vi } from "vitest";
import { consumeSSEStream } from "../src/lib/sse";
import { SSEEvent } from "../src/lib/types";

// Helper to create a ReadableStream from string chunks
function createMockStream(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });

  return stream.getReader();
}

describe("consumeSSEStream parser", () => {
  it("parses single token event block", async () => {
    const reader = createMockStream(["event: token\ndata: {\"content\": \"Hello\"}\n\n"]);
    const events: SSEEvent[] = [];

    await consumeSSEStream(reader, {
      onEvent: (e) => events.push(e),
    });

    expect(events.length).toBe(1);
    expect(events[0].event).toBe("token");
    expect(events[0].data).toEqual({ content: "Hello" });
  });

  it("parses sequential thinking and token chunks with done event", async () => {
    const rawChunks = [
      "event: thinking\ndata: {\"content\": \"Step 1\"}\n\n",
      "event: token\ndata: {\"content\": \"Answer text\"}\n\n",
      "event: done\ndata: {\"message\": \"Answer text\", \"thread_id\": \"t1\"}\n\n",
    ];
    const reader = createMockStream(rawChunks);
    const events: SSEEvent[] = [];

    await consumeSSEStream(reader, {
      onEvent: (e) => events.push(e),
    });

    expect(events.length).toBe(3);
    expect(events[0].event).toBe("thinking");
    expect(events[0].data.content).toBe("Step 1");
    expect(events[1].event).toBe("token");
    expect(events[1].data.content).toBe("Answer text");
    expect(events[2].event).toBe("done");
    expect(events[2].data.thread_id).toBe("t1");
  });

  it("correctly handles split/fragmented chunks across packet boundaries", async () => {
    const rawChunks = [
      "event: to",
      "ken\ndata: {\"con",
      "tent\": \"frag",
      "mented\"}\n\n",
    ];
    const reader = createMockStream(rawChunks);
    const events: SSEEvent[] = [];

    await consumeSSEStream(reader, {
      onEvent: (e) => events.push(e),
    });

    expect(events.length).toBe(1);
    expect(events[0].event).toBe("token");
    expect(events[0].data).toEqual({ content: "fragmented" });
  });

  it("dispatches error event when error event is emitted", async () => {
    const reader = createMockStream(["event: error\ndata: {\"error\": \"Model rate limit exceeded\"}\n\n"]);
    const events: SSEEvent[] = [];

    await consumeSSEStream(reader, {
      onEvent: (e) => events.push(e),
    });

    expect(events.length).toBe(1);
    expect(events[0].event).toBe("error");
    expect(events[0].data.error).toBe("Model rate limit exceeded");
  });
});
