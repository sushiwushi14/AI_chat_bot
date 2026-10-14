import React, { useState } from "react";
import { Brain, ChevronRight } from "lucide-react";

interface ThinkingBlockProps {
  thinking: string;
  isStreaming?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, isStreaming }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!thinking || !thinking.trim()) {
    return null;
  }

  const wordCount = thinking.trim().split(/\s+/).length;

  return (
    <div className="mb-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/60 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-left text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className={`w-3.5 h-3.5 text-brand-500 ${isStreaming ? "animate-pulse" : ""}`} />
          <span className="font-medium">
            {isStreaming ? "Thinking in progress..." : "Thought process"}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
            ({wordCount} words)
          </span>
        </div>

        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {isExpanded && (
        <div className="px-3.5 pb-3 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60 font-mono text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400 whitespace-pre-wrap max-h-60 overflow-y-auto">
          {thinking}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 ml-0.5 bg-brand-500 animate-pulse align-middle" />
          )}
        </div>
      )}
    </div>
  );
};
