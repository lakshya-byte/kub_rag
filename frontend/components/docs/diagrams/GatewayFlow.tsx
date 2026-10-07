"use client";

import { useState } from "react";

type Case = {
  id: string;
  label: string;
  hits: string[]; // boxes lit
  log: string[];
  result: string;
};

const BOXES = [
  { id: "req", label: "Request", sub: "from the responder" },
  { id: "cache", label: "Cache", sub: "simple mode" },
  { id: "p1", label: "Primary", sub: "@GROQ_SLUG / gpt-oss" },
  { id: "p2", label: "Fallback", sub: "@GROQ_SLUG_2 / gpt-oss" },
  { id: "res", label: "Response", sub: "back to the app" },
];

const CASES: Case[] = [
  {
    id: "normal",
    label: "Normal request",
    hits: ["req", "cache", "p1", "res"],
    log: ["Cache lookup: miss.", "Primary provider answers.", "Response stored in cache for next time."],
    result: "Answered by the primary provider. The UI shows no cache badge.",
  },
  {
    id: "hit",
    label: "Cache hit",
    hits: ["req", "cache", "res"],
    log: ["Cache lookup: hit.", "No provider is called."],
    result: "Instant answer. The `cache-status` header reads HIT, so the UI shows “Cache: Hit”.",
  },
  {
    id: "429",
    label: "Rate limited (429)",
    hits: ["req", "cache", "p1", "res"],
    log: ["Cache lookup: miss.", "Primary returns 429.", "Retry 1 of 2.", "Retry 2 of 2 succeeds."],
    result: "The retry hides the rate limit. Latency is higher, nothing else changes.",
  },
  {
    id: "down",
    label: "Primary keeps failing",
    hits: ["req", "cache", "p1", "p2", "res"],
    log: ["Cache lookup: miss.", "Primary fails, retries twice (429 or 503).", "Strategy is fallback: move to the second target.", "Fallback provider answers."],
    result: "Answered by the fallback provider. Check Portkey logs to see why the primary failed.",
  },
];

export default function GatewayFlow() {
  const [id, setId] = useState("normal");
  const c = CASES.find((x) => x.id === id)!;

  return (
    <div className="docs-figure p-4 sm:p-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Gateway situations">
        {CASES.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={x.id === id}
            onClick={() => setId(x.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              x.id === id ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-soft hover:border-accent/40"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Gateway path">
        {BOXES.map((b, i) => {
          const on = c.hits.includes(b.id);
          return (
            <li key={b.id} className="relative">
              <div
                className="h-full rounded-xl border p-3 transition-all duration-300"
                style={{
                  borderColor: on ? "var(--flow)" : "var(--line)",
                  background: on ? "var(--flow-soft)" : "transparent",
                  opacity: on ? 1 : 0.45,
                }}
              >
                <p className="text-sm font-semibold text-ink">{b.label}</p>
                <p className="mt-0.5 break-words text-xs text-ink-faint">{b.sub}</p>
              </div>
              {i < BOXES.length - 1 && (
                <span className="absolute -right-2.5 top-1/2 hidden -translate-y-1/2 text-ink-faint sm:block" aria-hidden>
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <ol className="mt-5 space-y-1.5 text-sm text-ink-soft" aria-live="polite">
        {c.log.map((l, i) => (
          <li key={l} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] text-accent">{i + 1}</span>
            {l}
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl border border-line bg-code/50 p-3 text-sm text-ink-soft">
        <span className="font-medium text-ink">Result. </span>
        {c.result.split("`").map((p, i) => (i % 2 ? <code key={i} className="docs-code-inline">{p}</code> : p))}
      </p>
    </div>
  );
}
