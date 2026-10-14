import React from "react";
import { Menu } from "lucide-react";
import { Model, Message, Theme } from "../lib/types";
import { ModelSelector } from "./ModelSelector";
import { ThemeToggle } from "./ThemeToggle";
import { MessageList } from "./MessageList";
import { EmptyState } from "./EmptyState";
import { Composer } from "./Composer";
import { Toast } from "./Toast";

interface ChatWindowProps {
  onOpenSidebar: () => void;
  models: Model[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  messages: Message[];
  isLoadingHistory: boolean;
  isStreaming: boolean;
  isTyping: boolean;
  onSendMessage: (content: string) => void;
  onStopStreaming: () => void;
  onRegenerate: () => void;
  onEditAndResend: (messageId: string, newContent: string) => void;
  errorMessage: string | null;
  onClearError: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  onOpenSidebar,
  models,
  selectedModel,
  onSelectModel,
  temperature,
  onTemperatureChange,
  theme,
  onThemeChange,
  messages,
  isLoadingHistory,
  isStreaming,
  isTyping,
  onSendMessage,
  onStopStreaming,
  onRegenerate,
  onEditAndResend,
  errorMessage,
  onClearError,
}) => {
  const currentModel = models.find((m) => m.id === selectedModel);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-zinc-950 overflow-hidden relative">
      {/* Top Header */}
      <header className="h-14 border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
            className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            temperature={temperature}
            onTemperatureChange={onTemperatureChange}
          />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {messages.length === 0 && !isLoadingHistory ? (
          <EmptyState
            onSelectPrompt={onSendMessage}
            selectedModelName={currentModel?.label}
          />
        ) : (
          <MessageList
            messages={messages}
            isLoadingHistory={isLoadingHistory}
            isTyping={isTyping}
            onRegenerate={onRegenerate}
            onEditAndResend={onEditAndResend}
            onRetry={onRegenerate}
          />
        )}

        {/* Pinned Bottom Composer */}
        <Composer
          onSendMessage={onSendMessage}
          onStopStreaming={onStopStreaming}
          isStreaming={isStreaming}
        />
      </main>

      {/* Global Error Toast */}
      <Toast message={errorMessage} onClose={onClearError} />
    </div>
  );
};
