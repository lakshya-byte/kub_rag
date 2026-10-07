export type QueryResponse = {
  question: string;
  answer: string | null;
  thought_process: string[] | null;
  status: string | null;
  sources: string[];
  /** filename + score for each entry in `sources`, same order */
  source_meta?: { source: string; score: number }[];
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function sendQuery(
  q: string,
  threadId: string,
  signal?: AbortSignal,
  /** how many messages the UI shows for this chat, so the server can rewind its memory to match */
  keepMessages?: number,
): Promise<QueryResponse> {
  const res = await fetch(`${API_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, thread_id: threadId, keep_messages: keepMessages }),
    signal,
  });
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  return res.json();
}
