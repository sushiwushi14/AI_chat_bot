import React, { useRef, useEffect, useState, useCallback } from "react";
import { ArrowDown } from "lucide-react";
import { Message } from "../lib/types";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface MessageListProps {
  messages: Message[];
  isLoadingHistory: boolean;
  isTyping: boolean;
  onRegenerate?: () => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
  onRetry?: () => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoadingHistory,
  isTyping,
  onRegenerate,
  onEditAndResend,
  onRetry,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);
  const isAutoScrollEnabledRef = useRef<boolean>(true);

  // Monitor user scrolling to detect if they scrolled up
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = distanceFromBottom < 80;

    isAutoScrollEnabledRef.current = isAtBottom;
    setShowScrollBottom(!isAtBottom);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomAnchorRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Auto-scroll when new messages or token stream arrives, unless user scrolled up
  useEffect(() => {
    if (isAutoScrollEnabledRef.current) {
      scrollToBottom(false);
    }
  }, [messages, isTyping, scrollToBottom]);

  if (isLoadingHistory) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-3xl mx-auto w-full space-y-6">
        <div className="flex items-start gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/4" />
            <div className="h-16 bg-slate-200 dark:bg-zinc-800 rounded-2xl w-3/4" />
          </div>
        </div>

        <div className="flex items-start gap-3 flex-row-reverse animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-zinc-800" />
          <div className="flex-1 space-y-2 flex flex-col items-end">
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/5" />
            <div className="h-10 bg-slate-200 dark:bg-zinc-800 rounded-2xl w-1/2" />
          </div>
        </div>

        <div className="flex items-start gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/4" />
            <div className="h-24 bg-slate-200 dark:bg-zinc-800 rounded-2xl w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  // Find index of last user and last assistant message for actions
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth relative"
    >
      <div className="max-w-3xl mx-auto w-full pb-8">
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id || index}
            message={message}
            isLastAssistant={index === lastAssistantIdx}
            isLastUser={index === lastUserIdx}
            onRegenerate={onRegenerate}
            onEditAndResend={onEditAndResend}
            onRetry={onRetry}
          />
        ))}

        {isTyping && <TypingIndicator />}

        <div ref={bottomAnchorRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-24 right-6 sm:right-12 z-30 p-2.5 rounded-full bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 shadow-lg border border-slate-200 dark:border-zinc-700 hover:scale-105 active:scale-95 transition-all"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
