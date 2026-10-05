"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const NODES = [
  { label: "Plan", detail: "Understanding your question" },
  { label: "Retrieve", detail: "Searching the knowledge base" },
  { label: "Rerank", detail: "Picking the best passages" },
  { label: "Respond", detail: "Writing the answer" },
];
// estimated hand-off times (s): the backend does not stream progress
const AT = [0, 1.6, 3.6, 6];

export default function Pipeline() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setT((performance.now() - start) / 1000), 200);
    return () => clearInterval(id);
  }, []);

  const active = AT.reduce((a, s, i) => (t >= s ? i : a), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card rounded-2xl p-4 sm:p-5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center">
        {NODES.map((n, i) => {
          const done = i < active;
          const cur = i === active;
          return (
            <div key={n.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <motion.span
                  animate={cur ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  transition={cur ? { duration: 1.4, repeat: Infinity } : undefined}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    done
                      ? "border-accent bg-accent text-paper"
                      : cur
                        ? "border-accent bg-accent-soft text-accent shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
                        : "border-line text-ink-faint"
                  }`}
                >
                  {done ? <Check size={14} /> : i + 1}
                </motion.span>
                <span className={`text-[11px] ${cur ? "font-medium text-ink" : "text-ink-faint"}`}>{n.label}</span>
              </div>
              {i < NODES.length - 1 && (
                <div className="relative mx-2 mb-5 h-px flex-1 bg-line">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-accent"
                    animate={{ width: done ? "100%" : cur ? "45%" : "0%" }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
        <span className="shimmer inline-block h-2 w-8 rounded-full" />
        {NODES[active].detail}…
        <span className="ml-auto text-[11px] text-ink-faint">estimated progress</span>
      </p>
    </motion.div>
  );
}
