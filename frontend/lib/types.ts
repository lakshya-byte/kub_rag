export type Feedback = "up" | "down";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thought?: string[];
  status?: string;
  sources?: string[];
  error?: boolean;
  /** play the typing reveal once, for freshly received answers (never persisted) */
  fresh?: boolean;
  /** the user question that produced this answer (for retry / regenerate) */
  question?: string;
  feedback?: Feedback;
  /** client-measured round trip */
  durationMs?: number;
};

export type Conversation = {
  id: string;
  /** backend LangGraph thread id: each chat owns its own memory */
  threadId: string;
  title: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};
