"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronRight, Copy, Info, Lightbulb, Search } from "lucide-react";
import { ENV_VARS, GLOSSARY, TROUBLES } from "@/docs/data";

/** Renders the tiny inline markup used in the content: `code` and **bold**. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

const TONES = {
  note: { icon: Info, bar: "var(--data)", bg: "var(--data-soft)" },
  warn: { icon: AlertTriangle, bar: "var(--stop)", bg: "var(--stop-soft)" },
  tip: { icon: Lightbulb, bar: "var(--ok)", bg: "var(--ok-soft)" },
} as const;

export function Callout({ tone, title, text }: { tone: keyof typeof TONES; title: string; text: string }) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <aside
      className="max-w-[41rem] rounded-2xl p-4 pl-5"
      style={{ background: t.bg, borderLeft: `3px solid ${t.bar}` }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon size={15} style={{ color: t.bar }} aria-hidden />
        {title}
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
        <Inline text={text} />
      </p>
    </aside>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {}
      }}
      aria-label={done ? "Copied" : label}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-faint transition hover:bg-line/60 hover:text-ink"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export function CodeBlock({ code, file, lang }: { code: string; file?: string; lang: string }) {
  return (
    <figure className="max-w-[48rem] overflow-hidden rounded-2xl border border-line bg-code">
      <figcaption className="flex items-center justify-between border-b border-line px-4 py-1.5 text-xs text-ink-faint">
        <span>{file ?? lang}</span>
        <CopyButton text={code} />
      </figcaption>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed" tabIndex={0}>
        <code className="font-mono" style={{ whiteSpace: "pre" }}>
          {code}
        </code>
      </pre>
    </figure>
  );
}

export function DocTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="max-w-[48rem] overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-code text-ink-soft">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((c, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? "font-medium text-ink" : "text-ink-soft"}`}>
                  <Inline text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Deep({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="max-w-[41rem] rounded-2xl border border-line bg-surface/60">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[15px] font-medium text-ink"
      >
        <ChevronRight size={15} className={`shrink-0 text-ink-faint transition-transform ${open ? "rotate-90" : ""}`} />
        {title}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-line px-4 py-4 text-[15px] leading-relaxed text-ink-soft">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Quiz({ q, options, answer, why }: { q: string; options: string[]; answer: number; why: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="max-w-[41rem] rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
      <p className="text-[15px] font-medium text-ink">Check yourself</p>
      <p className="mt-1 text-[15px] text-ink-soft">{q}</p>
      <ul className="mt-3 space-y-2">
        {options.map((o, i) => {
          const chosen = picked === i;
          const right = picked !== null && i === answer;
          const wrong = chosen && i !== answer;
          return (
            <li key={o}>
              <button
                disabled={picked !== null}
                onClick={() => setPicked(i)}
                className="flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left text-sm transition disabled:cursor-default"
                style={{
                  borderColor: right ? "var(--ok)" : wrong ? "var(--stop)" : "var(--line)",
                  background: right ? "var(--ok-soft)" : wrong ? "var(--stop-soft)" : "transparent",
                }}
              >
                <span className="flex-1 text-ink">{o}</span>
                {right && <Check size={15} style={{ color: "var(--ok)" }} aria-label="Correct" />}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          {picked === answer ? "Right. " : "Not quite. "}
          {why}
        </p>
      )}
    </div>
  );
}

const REQ_LABEL = { yes: "Required", no: "Optional", evals: "Evals only" } as const;
const REQ_COLOR = { yes: "var(--accent)", no: "var(--ink-faint)", evals: "var(--guard)" } as const;

export function EnvTable() {
  const [q, setQ] = useState("");
  const rows = useMemo(
    () => ENV_VARS.filter((v) => `${v.name} ${v.what}`.toLowerCase().includes(q.trim().toLowerCase())),
    [q],
  );
  return (
    <div className="max-w-[48rem] space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <Search size={14} className="text-ink-faint" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter variables"
          aria-label="Filter environment variables"
          className="w-full bg-transparent outline-none placeholder:text-ink-faint"
        />
      </label>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map((v) => (
          <li key={v.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[15rem_1fr]">
            <div>
              <code className="font-mono text-[13px] text-ink">{v.name}</code>
              <p className="mt-0.5 text-xs" style={{ color: REQ_COLOR[v.required] }}>
                {REQ_LABEL[v.required]}
              </p>
            </div>
            <div className="text-sm text-ink-soft">
              <p>{v.what}</p>
              <p className="mt-0.5 text-xs text-ink-faint">Get it from: {v.where}</p>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-ink-faint">No variable matches “{q}”.</li>}
      </ul>
    </div>
  );
}

export function TroubleList() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      TROUBLES.filter((t) =>
        `${t.symptom} ${t.message} ${t.cause} ${t.fix}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [q],
  );
  return (
    <div className="max-w-[48rem] space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <Search size={14} className="text-ink-faint" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Paste part of the error message"
          aria-label="Search troubleshooting"
          className="w-full bg-transparent outline-none placeholder:text-ink-faint"
        />
      </label>
      <ul className="space-y-2">
        {rows.map((t) => {
          const isOpen = open === t.id || (q.trim().length > 0 && rows.length <= 3);
          return (
            <li key={t.id} id={t.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <button
                onClick={() => setOpen(open === t.id ? null : t.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-2 px-4 py-3 text-left"
              >
                <ChevronRight
                  size={15}
                  className={`mt-1 shrink-0 text-ink-faint transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-ink">{t.symptom}</span>
                  <code className="mt-0.5 block break-words text-xs text-ink-faint" style={{ whiteSpace: "normal" }}>
                    {t.message}
                  </code>
                </span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-line px-4 py-3 pl-10 text-sm text-ink-soft">
                  <p>
                    <span className="font-medium text-ink">Cause. </span>
                    {t.cause}
                  </p>
                  <p>
                    <span className="font-medium text-ink">Fix. </span>
                    {t.fix}
                  </p>
                </div>
              )}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-2xl border border-line px-4 py-6 text-sm text-ink-faint">
            Nothing matches “{q}”. Check the Logfire trace for the failing stage, then compare with the span table above.
          </li>
        )}
      </ul>
    </div>
  );
}

export function GlossaryList() {
  const [q, setQ] = useState("");
  const rows = useMemo(
    () => GLOSSARY.filter((g) => `${g.term} ${g.def}`.toLowerCase().includes(q.trim().toLowerCase())),
    [q],
  );
  return (
    <div className="max-w-[48rem] space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
        <Search size={14} className="text-ink-faint" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Look up a term"
          aria-label="Search glossary"
          className="w-full bg-transparent outline-none placeholder:text-ink-faint"
        />
      </label>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((g) => (
          <div key={g.term} id={`g-${g.term.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            <dt className="font-serif text-lg font-semibold text-ink">{g.term}</dt>
            <dd className="text-sm leading-relaxed text-ink-soft">{g.def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
