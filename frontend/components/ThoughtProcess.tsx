"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Zap } from "lucide-react";

type Node = { label: string; text: string; state: "done" | "skipped" };

function build(steps: string[]): Node[] {
  const find = (p: string) => steps.find((s) => s.toLowerCase().startsWith(p.toLowerCase()));
  const skipped = steps.some((s) => s.toLowerCase().includes("retrieval: skipped"));
  const retrieved = steps.some((s) => s.toLowerCase().includes("context retrieved"));
  const cache = steps.some((s) => s.toLowerCase().includes("cache"));
  const search = find("Search Term:")?.replace(/^Search Term:\s*/i, "");

  return [
    { label: "Plan", text: find("Intent:")?.replace(/^Intent:\s*/i, "") ?? "Analysed the question", state: "done" },
    skipped
      ? { label: "Retrieve", text: "Skipped, answered from conversation memory", state: "skipped" }
      : { label: "Retrieve", text: search ? `Searched for “${search}”` : "Searched the knowledge base", state: "done" },
    skipped
      ? { label: "Rerank", text: "Skipped", state: "skipped" }
      : { label: "Rerank", text: retrieved ? "Kept the most relevant passages" : "Ranked passages", state: "done" },
    { label: "Respond", text: cache ? "Served instantly from gateway cache" : "Generated the answer", state: "done" },
  ];
}

export default function ThoughtProcess({
  steps,
  status,
  durationMs,
}: {
  steps: string[];
  status?: string;
  durationMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const cacheHit = steps.some((s) => s.toLowerCase().includes("cache"));
  const nodes = build(steps);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-ink-faint transition hover:text-ink-soft"
        aria-expanded={open}
      >
        <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
        How I answered
        {durationMs != null && <span className="text-xs">· {(durationMs / 1000).toFixed(1)}s</span>}
        {cacheHit && (
          <span className="ml-1 flex items-center gap-0.5 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
            <Zap size={10} /> cached
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3 overflow-hidden"
          >
            {nodes.map((n, i) => (
              <li key={n.label} className="relative flex gap-3 pb-3 last:pb-0">
                {i < nodes.length - 1 && <span className="absolute left-[7px] top-4 h-full w-px bg-line" />}
                <span
                  className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${
                    n.state === "done" ? "border-accent bg-accent" : "border-line bg-paper"
                  }`}
                />
                <div className={n.state === "skipped" ? "opacity-50" : ""}>
                  <p className="text-sm font-medium text-ink">{n.label}</p>
                  <p className="text-[13px] text-ink-soft">{n.text}</p>
                </div>
              </li>
            ))}
            {status && <p className="pl-7 pt-1 text-xs text-ink-faint">{status}</p>}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
