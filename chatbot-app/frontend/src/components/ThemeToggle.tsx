import React from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { Theme } from "../lib/types";

interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onThemeChange }) => {
  return (
    <div
      role="radiogroup"
      aria-label="Theme selector"
      className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-zinc-800/80 rounded-xl border border-slate-300/50 dark:border-zinc-700/50 shadow-sm"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        onClick={() => onThemeChange("light")}
        title="Light Mode"
        className={`p-1.5 rounded-lg transition-all duration-150 ${
          theme === "light"
            ? "bg-white text-amber-500 shadow-sm dark:bg-zinc-700"
            : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        <Sun className="w-4 h-4" />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === "system"}
        onClick={() => onThemeChange("system")}
        title="System Preference"
        className={`p-1.5 rounded-lg transition-all duration-150 ${
          theme === "system"
            ? "bg-white text-brand-600 shadow-sm dark:bg-zinc-700 dark:text-brand-400"
            : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        <Laptop className="w-4 h-4" />
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        onClick={() => onThemeChange("dark")}
        title="Dark Mode"
        className={`p-1.5 rounded-lg transition-all duration-150 ${
          theme === "dark"
            ? "bg-zinc-900 text-indigo-400 shadow-sm dark:bg-zinc-700"
            : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        <Moon className="w-4 h-4" />
      </button>
    </div>
  );
};
