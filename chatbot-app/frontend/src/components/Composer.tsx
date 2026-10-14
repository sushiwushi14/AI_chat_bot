import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Square } from "lucide-react";

interface ComposerProps {
  onSendMessage: (message: string) => void;
  onStopStreaming: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  onSendMessage,
  onStopStreaming,
  isStreaming,
  disabled = false,
}) => {
  const [input, setInput] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${newHeight}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (isStreaming) {
      onStopStreaming();
      return;
    }

    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSendMessage(trimmed);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const isSendDisabled = (!input.trim() && !isStreaming) || (disabled && !isStreaming);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-1">
      <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm focus-within:border-brand-500/80 dark:focus-within:border-brand-400/80 focus-within:ring-1 focus-within:ring-brand-500/30 transition-all p-2.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask SuperBot anything... (Shift + Enter for newline)"
          rows={1}
          maxLength={4000}
          disabled={disabled && !isStreaming}
          className="w-full bg-transparent text-sm resize-none focus:outline-none dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 max-h-44 pr-12 pl-1 py-1"
        />

        <div className="flex items-center justify-between pt-1 px-1">
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
            {input.length > 0 && `${input.length}/4000`}
          </span>

          {/* Action Button: Send or Stop */}
          <button
            type="button"
            onClick={handleSend}
            disabled={isSendDisabled}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${
              isStreaming
                ? "bg-red-500 hover:bg-red-600 text-white shadow-sm"
                : isSendDisabled
                ? "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed"
                : "bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:scale-105 active:scale-95"
            }`}
            title={isStreaming ? "Stop generation" : "Send message"}
          >
            {isStreaming ? (
              <Square className="w-4 h-4 fill-current" />
            ) : (
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-center text-slate-400 dark:text-zinc-500 mt-2">
        SuperBot powered by LangGraph. Check important information for accuracy.
      </p>
    </div>
  );
};
