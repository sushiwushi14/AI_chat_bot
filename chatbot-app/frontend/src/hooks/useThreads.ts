import { useState, useEffect, useCallback, useMemo } from "react";
import { Thread } from "../lib/types";
import { fetchThreads, createThread, renameThread, deleteThread } from "../lib/api";

export interface ThreadGroup {
  label: string;
  items: Thread[];
}

export function useThreads(initialThreadId?: string | null) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId || null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async (query?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchThreads(query);
      setThreads(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load chats.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads(searchQuery);
  }, [loadThreads, searchQuery]);

  const handleCreateNewThread = useCallback(async (model?: string): Promise<Thread | null> => {
    try {
      const newThread = await createThread(undefined, model);
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
      return newThread;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create thread.");
      return null;
    }
  }, []);

  const handleRenameThread = useCallback(async (threadId: string, title: string) => {
    try {
      const updated = await renameThread(threadId, title);
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, title: updated.title, updatedAt: updated.updatedAt } : t))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename chat.");
    }
  }, []);

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      try {
        await deleteThread(threadId);
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        if (activeThreadId === threadId) {
          const remaining = threads.filter((t) => t.id !== threadId);
          setActiveThreadId(remaining.length > 0 ? remaining[0].id : null);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to delete chat.");
      }
    },
    [activeThreadId, threads]
  );

  // Group threads by date
  const groupedThreads = useMemo((): ThreadGroup[] => {
    const today: Thread[] = [];
    const yesterday: Thread[] = [];
    const prev7Days: Thread[] = [];
    const older: Thread[] = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

    for (const thread of threads) {
      const updatedTime = new Date(thread.updatedAt).getTime();
      if (updatedTime >= startOfToday) {
        today.push(thread);
      } else if (updatedTime >= startOfYesterday) {
        yesterday.push(thread);
      } else if (updatedTime >= startOf7Days) {
        prev7Days.push(thread);
      } else {
        older.push(thread);
      }
    }

    const groups: ThreadGroup[] = [];
    if (today.length > 0) groups.push({ label: "Today", items: today });
    if (yesterday.length > 0) groups.push({ label: "Yesterday", items: yesterday });
    if (prev7Days.length > 0) groups.push({ label: "Previous 7 Days", items: prev7Days });
    if (older.length > 0) groups.push({ label: "Older", items: older });

    return groups;
  }, [threads]);

  return {
    threads,
    groupedThreads,
    activeThreadId,
    setActiveThreadId,
    isLoading,
    searchQuery,
    setSearchQuery,
    error,
    refreshThreads: loadThreads,
    createNewThread: handleCreateNewThread,
    renameThread: handleRenameThread,
    deleteThread: handleDeleteThread,
  };
}
