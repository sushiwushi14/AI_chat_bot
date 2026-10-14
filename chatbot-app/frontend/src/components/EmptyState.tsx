import React from "react";
import { Sparkles, MessageSquare, Terminal, HelpCircle } from "lucide-react";

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void;
  selectedModelName?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt, selectedModelName }) => {
  const suggestedPrompts = [
    {
      title: "Test Memory Retention",
      prompt: "Hi, my name is Krish and I like cricket.",
      icon: MessageSquare,
      desc: "Introduce yourself and test conversation memory on subsequent turns",
    },
    {
      title: "Explain Architecture",
      prompt: "How does LangGraph's StateGraph and checkpointer system work?",
      icon: Sparkles,
      desc: "Deep dive into node reducers and state snapshot persistence",
    },
    {
      title: "Python Code Generation",
      prompt: "Write a high-performance Python FastAPI endpoint that streams SSE events.",
      icon: Terminal,
      desc: "Generate clean async backend code with error handling",
    },
    {
      title: "Compare AI Models",
      prompt: "What are the key trade-offs between GPT-4o and open-weights reasoning models?",
      icon: HelpCircle,
      desc: "Analyze latency, throughput, token economics, and reasoning depth",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto w-full text-center animate-fade-in">
      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/50 dark:border-brand-800/50 text-brand-700 dark:text-brand-300 text-xs font-semibold mb-4 shadow-xs">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Production LangGraph Assistant</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 mb-2">
        How can I help you today?
      </h1>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-8 max-w-md">
        Ready to chat using {selectedModelName || "configured LLM models"} with real-time SSE token streaming and full conversation memory.
      </p>

      {/* Suggested Prompts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {suggestedPrompts.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 hover:border-brand-400 dark:hover:border-brand-500/50 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200">
                    {item.title}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2">
                  {item.desc}
                </p>
              </div>
              <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium mt-2 block opacity-0 group-hover:opacity-100 transition-opacity">
                Click to ask →
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
