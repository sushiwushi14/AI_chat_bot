import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, SlidersHorizontal, Sparkles, Zap } from "lucide-react";
import { Model } from "../lib/types";

interface ModelSelectorProps {
  models: Model[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  onSelectModel,
  temperature,
  onTemperatureChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTempPopover, setShowTempPopover] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tempPopoverRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (tempPopoverRef.current && !tempPopoverRef.current.contains(e.target as Node)) {
        setShowTempPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  return (
    <div className="flex items-center gap-2">
      {/* Model Selection Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700/80 rounded-xl shadow-xs hover:border-brand-500/50 dark:hover:border-brand-400/50 transition-colors"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-zinc-100">
            {currentModel ? currentModel.label : "Select Model"}
          </span>
          {currentModel?.badge && (
            <span className="hidden sm:inline-block text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200/50 dark:border-brand-800/50">
              {currentModel.badge}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div
            role="listbox"
            className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 animate-fade-in"
          >
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Available Models
            </div>

            {models.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 text-center">No models available.</div>
            ) : (
              models.map((m) => {
                const isSelected = m.id === selectedModel;
                return (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectModel(m.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex flex-col gap-1 ${
                      isSelected
                        ? "bg-brand-50 dark:bg-brand-950/50 border border-brand-300/40 dark:border-brand-800/50"
                        : "hover:bg-slate-100 dark:hover:bg-zinc-800/70 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {m.provider === "Groq" ? (
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        )}
                        <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">
                          {m.label}
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-slate-200/60 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                        {m.provider}
                      </span>
                    </div>

                    {m.description && (
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Temperature Popover */}
      <div className="relative" ref={tempPopoverRef}>
        <button
          type="button"
          title="Adjust Temperature"
          aria-expanded={showTempPopover}
          onClick={() => setShowTempPopover((prev) => !prev)}
          className={`p-2 rounded-xl border transition-colors ${
            showTempPopover
              ? "bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/60 dark:border-brand-500 dark:text-brand-300"
              : "bg-white dark:bg-zinc-800/90 border-slate-200 dark:border-zinc-700/80 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {showTempPopover && (
          <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-64 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                Temperature
              </span>
              <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 px-2 py-0.5 rounded-md">
                {temperature.toFixed(2)}
              </span>
            </div>

            <input
              type="range"
              min="0.0"
              max="2.0"
              step="0.05"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              className="w-full accent-brand-600 dark:accent-brand-400 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] text-slate-400 dark:text-zinc-500">
              <span>Precise (0.0)</span>
              <span>Balanced (0.7)</span>
              <span>Creative (2.0)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
