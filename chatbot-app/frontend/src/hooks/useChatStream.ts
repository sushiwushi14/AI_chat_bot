import { useState, useEffect, useRef, useCallback } from "react";
import { Message, ChatStreamPayload, SSEEvent, StreamDoneData } from "../lib/types";
import { fetchThread } from "../lib/api";
import { consumeSSEStream } from "../lib/sse";

interface UseChatStreamOptions {
  threadId: string | null;
  selectedModel: string;
  temperature: number;
  onThreadCreated?: (threadId: string, title?: string) => void;
  onThreadTitleUpdate?: (threadId: string, title: string) => void;
}

const BASE_URL = import.meta.env.VITE_API_URL || "";

export function useChatStream({
  threadId,
  selectedModel,
  temperature,
  onThreadCreated,
  onThreadTitleUpdate,
}: UseChatStreamOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentThreadIdRef = useRef<string | null>(threadId);

  useEffect(() => {
    currentThreadIdRef.current = threadId;
  }, [threadId]);

  // Load message history when threadId changes
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      setIsLoadingHistory(false);
      return;
    }

    let isMounted = true;
    async function loadHistory() {
      if (!threadId) return;
      try {
        setIsLoadingHistory(true);
        setStreamError(null);
        const { messages: history } = await fetchThread(threadId);
        if (isMounted) {
          setMessages(history);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setStreamError(err instanceof Error ? err.message : "Failed to load thread history.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [threadId]);

  // Stop current active streaming
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsTyping(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  }, []);

  // Send a new prompt or retry
  const sendMessage = useCallback(
    async (userPrompt: string) => {
      const cleanPrompt = userPrompt.trim();
      if (!cleanPrompt || isStreaming) return;

      // Cancel any ongoing stream
      stopStreaming();

      setStreamError(null);
      const userMessageId = `usr_${Date.now()}`;
      const assistantMessageId = `ast_${Date.now() + 1}`;

      const userMsg: Message = {
        id: userMessageId,
        role: "user",
        content: cleanPrompt,
        createdAt: new Date().toISOString(),
      };

      const assistantMsg: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        thinking: null,
        isStreaming: true,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setIsTyping(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const payload: ChatStreamPayload = {
        thread_id: currentThreadIdRef.current || undefined,
        message: cleanPrompt,
        model: selectedModel,
        temperature,
      };

      try {
        const response = await fetch(`${BASE_URL}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          let errText = `Server returned ${response.status} ${response.statusText}`;
          try {
            const errData = await response.json();
            if (errData.error || errData.detail) {
              errText = errData.error || errData.detail;
            }
          } catch {
            // fallback to default errText
          }
          throw new Error(errText);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Response body is not a readable stream.");
        }

        let accumulatedContent = "";
        let accumulatedThinking = "";

        await consumeSSEStream(reader, {
          signal: controller.signal,
          onEvent: (event: SSEEvent) => {
            if (event.event === "thinking") {
              setIsTyping(false);
              const chunk = (event.data.content as string) || "";
              accumulatedThinking += chunk;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, thinking: accumulatedThinking }
                    : msg
                )
              );
            } else if (event.event === "token") {
              setIsTyping(false);
              const chunk = (event.data.content as string) || "";
              accumulatedContent += chunk;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            } else if (event.event === "done") {
              setIsTyping(false);
              setIsStreaming(false);
              const doneData = event.data as unknown as StreamDoneData;
              const finalMsg = doneData.message || accumulatedContent;
              const finalThinking = doneData.thinking !== undefined ? doneData.thinking : accumulatedThinking;

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: finalMsg,
                        thinking: finalThinking || null,
                        isStreaming: false,
                      }
                    : msg
                )
              );

              // If new thread was assigned by server
              if (doneData.thread_id && doneData.thread_id !== currentThreadIdRef.current) {
                currentThreadIdRef.current = doneData.thread_id;
                onThreadCreated?.(doneData.thread_id, doneData.title);
              } else if (doneData.title && currentThreadIdRef.current) {
                onThreadTitleUpdate?.(currentThreadIdRef.current, doneData.title);
              }
            } else if (event.event === "error") {
              setIsTyping(false);
              setIsStreaming(false);
              const err = (event.data.error as string) || "An unknown error occurred during generation.";
              setStreamError(err);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, error: err, isStreaming: false }
                    : msg
                )
              );
            }
          },
          onError: (err: Error) => {
            setIsTyping(false);
            setIsStreaming(false);
            setStreamError(err.message);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, error: err.message, isStreaming: false }
                  : msg
              )
            );
          },
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return;
        }
        setIsTyping(false);
        setIsStreaming(false);
        const msg = err instanceof Error ? err.message : "Failed to connect to the backend server.";
        setStreamError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, error: msg, isStreaming: false } : m
          )
        );
      } finally {
        setIsStreaming(false);
        setIsTyping(false);
      }
    },
    [
      isStreaming,
      selectedModel,
      temperature,
      onThreadCreated,
      onThreadTitleUpdate,
      stopStreaming,
    ]
  );

  // Regenerate last assistant turn
  const regenerateLast = useCallback(() => {
    // Find last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Pop the last assistant message if it exists
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === lastUserMsg.id);
      return prev.slice(0, idx);
    });

    sendMessage(lastUserMsg.content);
  }, [messages, sendMessage]);

  // Edit user message and resend from that point
  const editAndResend = useCallback(
    (messageId: string, newContent: string) => {
      const targetIdx = messages.findIndex((m) => m.id === messageId);
      if (targetIdx === -1) return;

      // Slice history up to the target message
      setMessages((prev) => prev.slice(0, targetIdx));
      sendMessage(newContent);
    },
    [messages, sendMessage]
  );

  return {
    messages,
    isLoadingHistory,
    isStreaming,
    isTyping,
    streamError,
    sendMessage,
    stopStreaming,
    regenerateLast,
    editAndResend,
  };
}
