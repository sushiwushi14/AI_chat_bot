import { describe, it, expect } from "vitest";
import { Message } from "../src/lib/types";

describe("Message structure and stream state validation", () => {
  it("initializes user and assistant messages with unique IDs and roles", () => {
    const userPrompt = "Hi Krish";
    const userMsg: Message = {
      id: "usr_123",
      role: "user",
      content: userPrompt,
      createdAt: new Date().toISOString(),
    };

    const assistantMsg: Message = {
      id: "ast_124",
      role: "assistant",
      content: "",
      thinking: null,
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };

    expect(userMsg.role).toBe("user");
    expect(userMsg.content).toBe("Hi Krish");
    expect(assistantMsg.role).toBe("assistant");
    expect(assistantMsg.isStreaming).toBe(true);
    expect(assistantMsg.content).toBe("");
  });

  it("accumulates tokens into assistant message content", () => {
    let assistantMsg: Message = {
      id: "ast_124",
      role: "assistant",
      content: "",
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };

    const incomingChunks = ["Hello", " ", "there", "!"];
    for (const chunk of incomingChunks) {
      assistantMsg = {
        ...assistantMsg,
        content: assistantMsg.content + chunk,
      };
    }

    expect(assistantMsg.content).toBe("Hello there!");
  });

  it("finalizes message upon stream completion", () => {
    const activeMsg: Message = {
      id: "ast_124",
      role: "assistant",
      content: "Final answer.",
      thinking: "Thought step 1",
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };

    const completedMsg: Message = {
      ...activeMsg,
      isStreaming: false,
    };

    expect(completedMsg.isStreaming).toBe(false);
    expect(completedMsg.content).toBe("Final answer.");
    expect(completedMsg.thinking).toBe("Thought step 1");
  });
});
