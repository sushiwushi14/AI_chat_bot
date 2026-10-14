export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  thinking?: string | null;
  isStreaming?: boolean;
  error?: string | null;
  createdAt: string;
}

export interface Thread {
  id: string;
  title: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface Model {
  id: string;
  label: string;
  provider: string;
  badge?: string;
  description?: string;
  available: boolean;
  supports_thinking?: boolean;
}

export interface ChatStreamPayload {
  thread_id?: string;
  message: string;
  model?: string;
  temperature?: number;
  system_prompt?: string;
}

export interface SSEEvent {
  event: "token" | "thinking" | "done" | "error";
  data: Record<string, unknown>;
}

export interface StreamDoneData {
  message: string;
  thinking?: string | null;
  thread_id: string;
  title?: string;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export type Theme = "light" | "dark" | "system";
