"use client";

import { useState } from "react";

type Node = {
  id: string;
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  kind: "flow" | "data" | "guard" | "ext";
  role: string;
  file: string;
  fails: string;
};

const NODES: Node[] = [
  { id: "ui", label: "Chat UI", sub: "Next.js", x: 20, y: 150, w: 120, kind: "flow", role: "Collects the question, keeps chats in the browser, renders answers, citations and the Sources dropdown.", file: "frontend/components/Chat.tsx", fails: "CORS errors if its origin is not in CORS_ORIGINS. Chats vanish if browser storage is cleared." },
  { id: "api", label: "API", sub: "FastAPI", x: 190, y: 150, w: 120, kind: "flow", role: "Validates input, rewinds memory, runs the guardrail, invokes the agent and shapes the response.", file: "app/main.py", fails: "422 for bad input. Internal failures come back as status 'error' with HTTP 200." },
  { id: "guard", label: "Guardrail", sub: "classifier", x: 360, y: 60, w: 130, kind: "guard", role: "One short model call labels the message, made straight to Groq with GROQ_API_KEY (not through Portkey). Anything but PASS returns a canned reply immediately.", file: "app/guardrails/classifier.py", fails: "Fails open: if the classifier errors, the message passes and the error is logged." },
  { id: "agent", label: "Agent", sub: "LangGraph", x: 360, y: 150, w: 130, kind: "flow", role: "Planner, retriever and responder sharing one typed state, with routing between them.", file: "app/agents/graph.py", fails: "A node exception surfaces as an error answer. State is saved per thread." },
  { id: "mem", label: "Memory", sub: "SQLite", x: 360, y: 240, w: 130, kind: "data", role: "Stores each conversation thread so history survives restarts.", file: "app/agents/graph.py", fails: "Falls back to in-memory storage with a warning if the SQLite package is missing." },
  { id: "gw", label: "Gateway", sub: "Portkey", x: 560, y: 60, w: 120, kind: "ext", role: "Fronts the chat model: fallback to a second provider, retry on 429 and 503, optional cache.", file: "app/gateway/client.py", fails: "Rejects inline configs on some workspaces. Needs real slugs in the saved config." },
  { id: "llm", label: "Chat model", sub: "Groq gpt-oss", x: 720, y: 60, w: 130, kind: "ext", role: "Writes the planner's search query and the final answer.", file: "(external)", fails: "Rate limits and model access errors. Fallback usually hides them." },
  { id: "vec", label: "Vector store", sub: "Qdrant", x: 560, y: 150, w: 120, kind: "data", role: "Holds every chunk's embedding and text and returns the nearest ones above the score cutoff.", file: "app/services/retrieval/qdrant_service.py", fails: "Infrastructure errors are raised, never mistaken for 'no results'." },
  { id: "emb", label: "Embeddings", sub: "OpenAI", x: 720, y: 150, w: 130, kind: "ext", role: "Turns the question into a vector for search, and every chunk into a vector at ingestion.", file: "app/services/retrieval/embeddings.py", fails: "An expired key (401) breaks both search and ingestion." },
  { id: "rank", label: "Reranker", sub: "FlashRank", x: 560, y: 240, w: 120, kind: "data", role: "Local model that re-scores the retrieved chunks and keeps the best 5.", file: "app/services/retrieval/ranking_service.py", fails: "First call is slower while the model loads." },
  { id: "ing", label: "Ingestion", sub: "offline job", x: 190, y: 330, w: 120, kind: "data", role: "Reads files, cuts them by meaning, embeds and upserts chunks with stable IDs.", file: "app/ingestion/processors.py", fails: "Per-file failures are collected and the run exits 1 so none are silent." },
  { id: "evals", label: "Evals", sub: "RAGAS judge", x: 190, y: 240, w: 120, kind: "ext", role: "Offline quality checks. Sends the golden questions to the running API, then a separate Groq judge (JUDGE_GROQ, called directly, not through Portkey) scores faithfulness, relevancy, precision, recall and correctness. Also scores the guardrail.", file: "evals/ (app.py, metrics.py, demo.py)", fails: "Stops with a clear message if JUDGE_GROQ is missing. Scores are only meaningful once documents are ingested and the API answers." },
  { id: "obs", label: "Logfire", sub: "traces", x: 20, y: 330, w: 120, kind: "ext", role: "Receives a trace per request showing each stage and its timing.", file: "app/main.py", fails: "Without a token the app still runs and nothing is sent." },
];

const EDGES: [string, string, boolean?][] = [
  ["ui", "api"], ["api", "guard"], ["api", "agent"], ["agent", "mem"], ["guard", "llm"],
  ["agent", "vec"], ["vec", "emb"], ["agent", "rank"], ["agent", "gw"], ["gw", "llm"],
  ["ing", "emb", true], ["ing", "vec", true], ["evals", "api"],
];

const KIND = {
  flow: "var(--flow)",
  data: "var(--data)",
  guard: "var(--guard)",
  ext: "var(--ink-faint)",
} as const;

const H = 56;

export default function Architecture() {
  const [sel, setSel] = useState("agent");
  const node = NODES.find((n) => n.id === sel)!;
  const byId = (id: string) => NODES.find((n) => n.id === id)!;
  const center = (n: Node) => ({ x: n.x + n.w / 2, y: n.y + H / 2 });

  return (
    <div className="docs-figure p-4 sm:p-6">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 870 424" className="min-w-[44rem]" role="group" aria-label="System architecture. Select a box for details.">
          {EDGES.map(([a, b, dashed], i) => {
            const A = center(byId(a));
            const B = center(byId(b));
            const on = sel === a || sel === b;
            const over = a === "guard" && b === "llm"; // arc over the gateway box
            return (
              <path
                key={i}
                d={over ? `M${A.x} ${byId(a).y} V 34 H ${B.x} V ${byId(b).y}` : `M${A.x} ${A.y} C ${(A.x + B.x) / 2} ${A.y}, ${(A.x + B.x) / 2} ${B.y}, ${B.x} ${B.y}`}
                className={`dg-edge ${on ? "on" : ""} ${dashed ? "dg-flow" : ""}`}
                style={dashed ? { stroke: "var(--data)" } : undefined}
              />
            );
          })}
          {NODES.map((n) => {
            const on = sel === n.id;
            return (
              <g
                key={n.id}
                className="dg-node"
                tabIndex={0}
                role="button"
                aria-pressed={on}
                aria-label={`${n.label}, ${n.sub}`}
                onClick={() => setSel(n.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(n.id))}
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.w}
                  height={H}
                  rx={14}
                  fill={on ? `color-mix(in srgb, ${KIND[n.kind]} 16%, var(--surface))` : "var(--surface)"}
                  stroke={on ? KIND[n.kind] : "var(--line)"}
                  strokeWidth={on ? 2.5 : 1.5}
                />
                <text x={n.x + 14} y={n.y + 24} className="dg-text" fontSize="14" fontWeight="600">
                  {n.label}
                </text>
                <text x={n.x + 14} y={n.y + 42} className="dg-text dg-faint" fontSize="11.5">
                  {n.sub}
                </text>
                <circle cx={n.x + n.w - 14} cy={n.y + 14} r={4} fill={KIND[n.kind]} />
              </g>
            );
          })}
          <text x="20" y="414" className="dg-text dg-faint" fontSize="11">
            Dashed teal lines: ingestion, which runs ahead of time. Purple: safety. Teal: data. Terracotta: request path.
          </text>
        </svg>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-code/60 p-4" aria-live="polite">
        <p className="text-base font-semibold text-ink">
          {node.label} <span className="font-normal text-ink-faint">{node.sub}</span>
        </p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{node.role}</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[6rem_1fr]">
          <dt className="text-ink-faint">Lives in</dt>
          <dd>
            <code className="font-mono text-[13px] text-ink">{node.file}</code>
          </dd>
          <dt className="text-ink-faint">Can fail by</dt>
          <dd className="text-ink-soft">{node.fails}</dd>
        </dl>
      </div>
    </div>
  );
}
