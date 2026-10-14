import { SSEEvent } from "./types";

export interface StreamSSEOptions {
  onEvent: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * Parses a Server-Sent Events (SSE) ReadableStream chunk by chunk.
 * Handles partial line chunks, multiple event blocks, and SSE formatting (event/data).
 */
export async function consumeSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: StreamSSEOptions
): Promise<void> {
  const { onEvent, onError, signal } = options;
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  let currentEventType: SSEEvent["event"] = "token";
  let currentDataLines: string[] = [];

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep unfinished line in buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === "") {
          // Empty line indicates dispatch of current event block
          if (currentDataLines.length > 0) {
            const rawData = currentDataLines.join("\n");
            try {
              const parsed = JSON.parse(rawData);
              onEvent({
                event: currentEventType,
                data: parsed,
              });
            } catch {
              // Plaintext fallback
              onEvent({
                event: currentEventType,
                data: { content: rawData },
              });
            }
          }
          currentEventType = "token";
          currentDataLines = [];
          continue;
        }

        if (trimmed.startsWith(":")) {
          // SSE comment/keepalive line, ignore
          continue;
        }

        if (trimmed.startsWith("event:")) {
          const ev = trimmed.slice(6).trim();
          if (ev === "token" || ev === "thinking" || ev === "done" || ev === "error") {
            currentEventType = ev;
          }
        } else if (trimmed.startsWith("data:")) {
          currentDataLines.push(trimmed.slice(5).trim());
        }
      }
    }

    // Flush remaining buffer if complete block was left
    if (buffer.trim().length > 0) {
      if (buffer.startsWith("data:")) {
        const raw = buffer.slice(5).trim();
        try {
          onEvent({ event: currentEventType, data: JSON.parse(raw) });
        } catch {
          onEvent({ event: currentEventType, data: { content: raw } });
        }
      }
    }
  } catch (err: unknown) {
    if (signal?.aborted) {
      return;
    }
    if (err instanceof Error && err.name !== "AbortError") {
      onError?.(err);
    }
  }
}
