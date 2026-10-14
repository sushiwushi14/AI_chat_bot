import { Model, Thread, Message } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL || "";

export async function fetchModels(): Promise<{ models: Model[]; default: string }> {
  const res = await fetch(`${BASE_URL}/api/models`);
  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchThreads(search?: string): Promise<Thread[]> {
  const url = new URL(`${BASE_URL}/api/threads`, window.location.origin);
  if (search && search.trim()) {
    url.searchParams.set("search", search.trim());
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch threads: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchThread(threadId: string): Promise<{ thread: Thread; messages: Message[] }> {
  const res = await fetch(`${BASE_URL}/api/threads/${encodeURIComponent(threadId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch thread ${threadId}: ${res.statusText}`);
  }
  const data = await res.json();
  const thread: Thread = {
    id: data.id,
    title: data.title,
    model: data.model,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
  const messages: Message[] = (data.messages || []).map((m: {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    thinking?: string | null;
    created_at: string;
  }) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    thinking: m.thinking,
    createdAt: m.created_at,
  }));

  return { thread, messages };
}

export async function createThread(title?: string, model?: string): Promise<Thread> {
  const res = await fetch(`${BASE_URL}/api/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, model }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create thread: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    id: data.id,
    title: data.title,
    model: data.model,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    messageCount: 0,
  };
}

export async function renameThread(threadId: string, title: string): Promise<Thread> {
  const res = await fetch(`${BASE_URL}/api/threads/${encodeURIComponent(threadId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(`Failed to rename thread: ${res.statusText}`);
  }
  const data = await res.json();
  return {
    id: data.id,
    title: data.title,
    model: data.model,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteThread(threadId: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete thread: ${res.statusText}`);
  }
  return true;
}

export async function fetchHealth(): Promise<{ status: string; providers: Record<string, boolean> }> {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}
