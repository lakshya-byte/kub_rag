"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerDownLeft, Search } from "lucide-react";
import { fuzzyScore } from "@/lib/fuzzy";

export type Command = {
  id: string;
  label: string;
  group: string;
  hint?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  run: () => void;
};

function Palette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    if (!q.trim()) return commands;
    return commands
      .map((c) => {
        const byLabel = fuzzyScore(q.trim(), c.label);
        const byGroup = fuzzyScore(q.trim(), `${c.group} ${c.label}`);
        const base = byLabel >= 0 ? byLabel : byGroup >= 0 ? byGroup - 3 : null;
        return { c, s: base === null ? null : base - c.label.length * 0.05 };
      })
      .filter((r): r is { c: Command; s: number } => r.s !== null)
      .sort((a, b) => b.s - a.s)
      .reduce<{ c: Command; s: number }[][]>((groups, r) => {
        // cluster by group (ordered by each group's best hit) so headings never repeat
        const g = groups.find((x) => x[0].c.group === r.c.group);
        if (g) g.push(r);
        else groups.push([r]);
        return groups;
      }, [])
      .flat()
      .map((r) => r.c);
  }, [commands, q]);

  const safeIdx = Math.min(idx, Math.max(results.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${safeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [safeIdx]);

  const run = (c?: Command) => {
    if (!c) return;
    onClose();
    // let the dialog unmount first so focus targets resolve cleanly
    setTimeout(c.run, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14dvh]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-label="Command palette"
        className="card relative w-full max-w-xl overflow-hidden rounded-3xl shadow-[var(--shadow-lg)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search size={16} className="text-ink-faint" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIdx(Math.min(safeIdx + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIdx(Math.max(safeIdx - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(results[safeIdx]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Type a command or search chats…"
            role="combobox"
            aria-expanded
            aria-controls="palette-list"
            aria-activedescendant={results[safeIdx] ? `cmd-${results[safeIdx].id}` : undefined}
            className="w-full bg-transparent py-4 text-[15px] outline-none placeholder:text-ink-faint"
          />
          <kbd>esc</kbd>
        </div>

        <ul ref={listRef} id="palette-list" role="listbox" className="max-h-[50dvh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-faint">No results.</li>}
          {results.map((c, i) => {
            const showGroup = i === 0 || results[i - 1].group !== c.group;
            return (
              <li key={c.id} role="presentation">
                {showGroup && <p className="eyebrow px-3 pb-1 pt-3">{c.group}</p>}
                <button
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={i === safeIdx}
                  data-i={i}
                  onMouseMove={() => setIdx(i)}
                  onClick={() => run(c)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    i === safeIdx ? "bg-accent-soft text-ink" : "text-ink-soft"
                  }`}
                >
                  <c.icon size={15} className={i === safeIdx ? "text-accent" : "text-ink-faint"} />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.hint && <kbd>{c.hint}</kbd>}
                  {i === safeIdx && <CornerDownLeft size={13} className="text-ink-faint" />}
                </button>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </div>
  );
}

export default function CommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: Command[];
  onClose: () => void;
}) {
  // Palette mounts fresh on every open, so query/selection reset without effects.
  return <AnimatePresence>{open && <Palette commands={commands} onClose={onClose} />}</AnimatePresence>;
}
