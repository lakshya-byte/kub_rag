export type Level = "basic" | "intermediate" | "advanced";

export type Block =
  | { t: "p"; text: string }
  | { t: "h"; text: string }
  | { t: "list"; items: string[]; ordered?: boolean }
  | { t: "code"; lang: string; code: string; file?: string }
  | { t: "callout"; tone: "note" | "warn" | "tip"; title: string; text: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "diagram"; name: DiagramName; caption?: string }
  | { t: "quiz"; q: string; options: string[]; answer: number; why: string }
  | { t: "deep"; title: string; blocks: Block[] }
  | { t: "env" }
  | { t: "troubleshooting" }
  | { t: "glossary" };

export type DiagramName =
  | "tracer"
  | "lifecycle"
  | "architecture"
  | "chunking"
  | "retrieval"
  | "memory"
  | "guardrails"
  | "gateway"
  | "evals";

export type Section = {
  id: string;
  title: string;
  level: Level;
  summary: string;
  learn: string[];
  blocks: Block[];
};
