"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { spotlight } from "@/lib/motion";

function clean(s: string) {
  return s.replace(/^CONTENT:\s*/i, "").trim();
}

export default function Sources({
  sources,
  idPrefix,
  highlight,
}: {
  sources: string[];
  idPrefix: string;
  highlight: number | null;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="space-y-2.5">
      <p className="eyebrow">Sources</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {sources.map((src, i) => {
          const n = i + 1;
          const open = openIdx === i || highlight === n;
          const hl = highlight === n;
          return (
            <motion.button
              key={i}
              layout
              id={`${idPrefix}-src-${n}`}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              onMouseMove={spotlight}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              className={`spot card rounded-2xl p-3.5 text-left text-[13px] leading-relaxed text-ink-soft transition-colors ${
                open ? "sm:col-span-2" : ""
              } ${hl ? "!border-accent ring-2 ring-accent/30" : "hover:border-accent/40"}`}
              aria-expanded={open}
            >
              <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-ink">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent">
                  {n}
                </span>
                Source
              </span>
              <span className={open ? "block" : "line-clamp-3 block"}>{clean(src)}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
