"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, BookOpen, CircleHelp, Menu, MessageSquare, Search, X } from "lucide-react";
import { SECTIONS } from "@/docs/sections";
import { GLOSSARY, TROUBLES } from "@/docs/data";
import type { Level } from "@/docs/types";
import CommandPalette, { type Command } from "@/components/CommandPalette";
import ThemeToggle from "@/components/ThemeToggle";
import Section from "./Section";
import { Diagram } from "./diagrams";
import "./docs.css";

const RANK: Record<Level, number> = { basic: 1, intermediate: 2, advanced: 3 };
const DEPTHS: { id: Level; label: string; hint: string }[] = [
  { id: "basic", label: "Essentials", hint: "Basics only" },
  { id: "intermediate", label: "Deeper", hint: "Basics and how things work" },
  { id: "advanced", label: "Everything", hint: "All chapters, including internals" },
];

function LevelMark({ level }: { level: Level }) {
  const n = RANK[level];
  return (
    <span className="flex items-end gap-[2px]" role="img" aria-label={`${level} level`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm"
          style={{ height: 4 + i * 2, background: i <= n ? "var(--accent)" : "var(--line)" }}
        />
      ))}
    </span>
  );
}

export default function DocsApp() {
  const [depth, setDepth] = useState<Level>("advanced");
  const [active, setActive] = useState(SECTIONS[0].id);
  const [progress, setProgress] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const spyLock = useRef(false);

  const visible = useMemo(() => SECTIONS.filter((s) => RANK[s.level] <= RANK[depth]), [depth]);

  const chooseDepth = (d: Level) => setDepth(d);

  // reading progress + scroll-spy (the active chapter is the last one whose top has passed 30% of the viewport)
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(1, window.scrollY / h) : 0);
      if (spyLock.current) return;
      const line = window.innerHeight * 0.3;
      let current = visible[0]?.id;
      for (const s of visible) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      if (current) setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [visible]);

  const goTo = useCallback(
    (id: string) => {
      const el = () => document.getElementById(id);
      const run = () => {
        spyLock.current = true;
        const target = el();
        if (!target) {
          spyLock.current = false;
          return;
        }
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        const sec = SECTIONS.find((s) => s.id === id || s.blocks.length === 0);
        if (SECTIONS.some((s) => s.id === id)) setActive(id);
        else if (sec) setActive("troubleshooting");
        setTimeout(() => (spyLock.current = false), 900);
      };
      if (!el()) {
        setDepth("advanced");
        setTimeout(run, 80);
      } else run();
      setTocOpen(false);
    },
    [],
  );

  // keyboard: / or Cmd/Ctrl+K search, j/k hop between chapters
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "j" || e.key === "k") {
        const i = visible.findIndex((s) => s.id === active);
        const next = visible[Math.min(visible.length - 1, Math.max(0, i + (e.key === "j" ? 1 : -1)))];
        if (next) goTo(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, active, goTo]);

  const commands = useMemo<Command[]>(
    () => [
      ...SECTIONS.map((s) => ({
        id: `s-${s.id}`,
        label: s.title,
        group: "Chapters",
        hint: s.level,
        icon: BookOpen,
        run: () => goTo(s.id),
      })),
      ...TROUBLES.map((t) => ({
        id: t.id,
        label: t.symptom,
        group: "Troubleshooting",
        icon: CircleHelp,
        run: () => goTo(t.id),
      })),
      ...GLOSSARY.map((g) => ({
        id: `g-${g.term}`,
        label: g.term,
        group: "Glossary",
        icon: CircleHelp,
        run: () => goTo("glossary"),
      })),
    ],
    [goTo],
  );

  const rail = (
    <nav aria-label="Chapters">
      <ol className="space-y-0.5">
        {SECTIONS.map((s) => {
          const shown = RANK[s.level] <= RANK[depth];
          const on = active === s.id;
          return (
            <li key={s.id}>
              <button
                onClick={() => goTo(s.id)}
                aria-current={on ? "location" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                  on ? "bg-accent-soft font-medium text-ink" : "text-ink-soft hover:bg-line/50"
                } ${shown ? "" : "opacity-40"}`}
              >
                <LevelMark level={s.level} />
                <span className="truncate">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  return (
    <div className="docs min-h-full bg-paper text-ink">
      <header className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-14 max-w-[88rem] items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setTocOpen(true)}
            aria-label="Open chapters"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-line/60 lg:hidden"
          >
            <Menu size={18} />
          </button>
          <Link href="/" className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-ink-soft hover:bg-line/60">
            <ArrowLeft size={15} aria-hidden />
            <span className="hidden sm:inline">Back to chat</span>
            <MessageSquare size={15} className="sm:hidden" aria-label="Back to chat" />
          </Link>
          <p className="hidden font-serif text-lg font-semibold sm:block">Documentation</p>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden rounded-full border border-line p-0.5 md:flex" role="radiogroup" aria-label="How deep to go">
              {DEPTHS.map((d) => (
                <button
                  key={d.id}
                  role="radio"
                  aria-checked={depth === d.id}
                  title={d.hint}
                  onClick={() => chooseDepth(d.id)}
                  className={`rounded-full px-3 py-1 text-sm transition ${
                    depth === d.id ? "bg-accent text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-ink-faint transition hover:text-ink-soft"
            >
              <Search size={14} aria-hidden />
              <span className="hidden sm:inline">Search</span>
              <kbd>⌘K</kbd>
            </button>
            <ThemeToggle />
          </div>
        </div>
        <div className="h-0.5 bg-transparent" aria-hidden>
          <div className="h-full origin-left bg-accent transition-transform duration-150" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </header>

      <div className="mx-auto grid max-w-[88rem] gap-10 px-4 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] overflow-y-auto py-8 lg:block">
          {rail}
          <p className="mt-6 px-2.5 text-xs leading-relaxed text-ink-faint">
            Press <kbd>/</kbd> to search, <kbd>j</kbd> and <kbd>k</kbd> to move between chapters.
          </p>
        </aside>

        <main className="min-w-0 pb-32">
          <div className="max-w-[56rem] pt-12 sm:pt-16">
            <h1 className="max-w-[16ch] font-serif text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
              How a question becomes an answer
            </h1>
            <p className="docs-prose mt-5 text-ink-soft">
              A tour of this assistant, from the first idea to the internals. Pick a question and watch it move through the system.
            </p>
            <div className="mt-8">
              <Diagram name="tracer" />
            </div>
          </div>

          <div className="mt-6 divide-y divide-line">
            {visible.map((s) => (
              <Section key={s.id} s={s} />
            ))}
          </div>

          <p className="mt-16 text-sm text-ink-faint">
            These docs describe the code in this repository. Sample scores and timings in the demos are illustrative.
          </p>
        </main>
      </div>

      <AnimatePresence>
        {tocOpen && (
          <>
            <motion.button
              aria-label="Close chapters"
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTocOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 w-[18rem] overflow-y-auto border-r border-line bg-paper p-4"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              role="dialog"
              aria-label="Chapters"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="font-serif text-lg font-semibold">Chapters</p>
                <button onClick={() => setTocOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-line/60">
                  <X size={16} />
                </button>
              </div>
              <div className="mb-4 flex rounded-full border border-line p-0.5" role="radiogroup" aria-label="How deep to go">
                {DEPTHS.map((d) => (
                  <button
                    key={d.id}
                    role="radio"
                    aria-checked={depth === d.id}
                    onClick={() => chooseDepth(d.id)}
                    className={`flex-1 rounded-full px-2 py-1 text-xs ${depth === d.id ? "bg-accent text-white" : "text-ink-soft"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {rail}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
