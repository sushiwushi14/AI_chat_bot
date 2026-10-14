import React, { useState, useEffect, useCallback } from "react";
import { Model } from "./lib/types";
import { fetchModels } from "./lib/api";
import { useTheme } from "./hooks/useTheme";
import { useThreads } from "./hooks/useThreads";
import { useChatStream } from "./hooks/useChatStream";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";

export const App: React.FC = () => {
  const { theme, setTheme } = useTheme();

  // URL route parsing: check if URL contains /chat/:threadId or ?thread=
  const getThreadIdFromUrl = (): string | null => {
    const path = window.location.pathname;
    const match = path.match(/\/chat\/([^/?#]+)/);
    if (match && match[1] && match[1] !== "new") {
      return match[1];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("thread") || null;
  };

  const initialUrlThreadId = getThreadIdFromUrl();

  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    groupedThreads,
    activeThreadId,
    setActiveThreadId,
    isLoading: isLoadingThreads,
    searchQuery,
    setSearchQuery,
    renameThread,
    deleteThread,
    refreshThreads,
  } = useThreads(initialUrlThreadId);

  // Sync activeThreadId to browser URL without full page reload
  const updateUrlThreadId = useCallback((threadId: string | null) => {
    if (threadId) {
      window.history.pushState({}, "", `/chat/${encodeURIComponent(threadId)}`);
    } else {
      window.history.pushState({}, "", "/");
    }
  }, []);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const tid = getThreadIdFromUrl();
      setActiveThreadId(tid);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveThreadId]);

  // Load models on startup
  useEffect(() => {
    async function loadModels() {
      try {
        const data = await fetchModels();
        setModels(data.models);
        if (data.default) {
          setSelectedModel(data.default);
        } else if (data.models.length > 0) {
          setSelectedModel(data.models[0].id);
        }
      } catch (err: unknown) {
        setGlobalError("Could not connect to backend to fetch available models.");
      }
    }
    loadModels();
  }, []);

  const handleThreadCreated = useCallback(
    (newThreadId: string, _title?: string) => {
      setActiveThreadId(newThreadId);
      updateUrlThreadId(newThreadId);
      refreshThreads();
    },
    [setActiveThreadId, updateUrlThreadId, refreshThreads]
  );

  const handleThreadTitleUpdate = useCallback(
    (_tid: string, _title: string) => {
      refreshThreads();
    },
    [refreshThreads]
  );

  const {
    messages,
    isLoadingHistory,
    isStreaming,
    isTyping,
    streamError,
    sendMessage,
    stopStreaming,
    regenerateLast,
    editAndResend,
  } = useChatStream({
    threadId: activeThreadId,
    selectedModel,
    temperature,
    onThreadCreated: handleThreadCreated,
    onThreadTitleUpdate: handleThreadTitleUpdate,
  });

  const handleSelectThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
      updateUrlThreadId(threadId);
    },
    [setActiveThreadId, updateUrlThreadId]
  );

  const handleNewChat = useCallback(() => {
    setActiveThreadId(null);
    updateUrlThreadId(null);
  }, [setActiveThreadId, updateUrlThreadId]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        groupedThreads={groupedThreads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        onRenameThread={renameThread}
        onDeleteThread={(tid) => {
          deleteThread(tid);
          if (activeThreadId === tid) {
            handleNewChat();
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isLoading={isLoadingThreads}
      />

      <ChatWindow
        onOpenSidebar={() => setIsSidebarOpen(true)}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        temperature={temperature}
        onTemperatureChange={setTemperature}
        theme={theme}
        onThemeChange={setTheme}
        messages={messages}
        isLoadingHistory={isLoadingHistory}
        isStreaming={isStreaming}
        isTyping={isTyping}
        onSendMessage={sendMessage}
        onStopStreaming={stopStreaming}
        onRegenerate={regenerateLast}
        onEditAndResend={editAndResend}
        errorMessage={streamError || globalError}
        onClearError={() => setGlobalError(null)}
      />
    </div>
  );
};
