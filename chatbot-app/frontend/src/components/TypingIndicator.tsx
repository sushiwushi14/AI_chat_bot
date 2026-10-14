import React from "react";
import { Bot } from "lucide-react";

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-start gap-3 my-2 animate-fade-in">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-sm">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex items-center gap-1.5 px-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl rounded-tl-sm shadow-xs">
        <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium mr-1.5">
          Thinking
        </span>
        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" />
      </div>
    </div>
  );
};
