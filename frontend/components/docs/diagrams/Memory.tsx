"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

type Msg = { role: "user" | "assistant"; text: string; stale?: boolean };

export default function Memory() {
  const [ui, setUi] = useState<Msg[]>([]);
  const [server, setServer] = useState<Msg[]>([]);
  const [sync, setSync] = useState(true);
  const [n, setN] = useState(1);
  const [note, setNote] = useState("Ask a question to begin.");

  /** Mirrors the real flow: the UI sends keep_messages = messages it shows, the API trims the saved thread first. */
  const send = (u: Msg[], s: Msg[], question: string, stop: boolean, k: number) => {
    let srv = s;
    let msg = "";
    if (sync && srv.length > u.length) {
      msg = `Server held ${srv.length} messages but the UI shows ${u.length}. keep_messages=${u.length} rewound it before running. `;
      srv = srv.slice(0, u.length);
    }
    const q: Msg = { role: "user", text: question };
    const a: Msg = { role: "assistant", text: `Answer ${k}` };
    setServer([...srv, q, a]);
    setUi(stop ? [...u, q] : [...u, q, a]);
    setNote(
      msg +
        (stop
          ? "You pressed Stop, so the UI dropped the answer, but the server finished and saved it."
          : "Both sides agree."),
    );
  };

  const ask = (stop: boolean) => {
    send(ui, server, `Question ${n}`, stop, n);
    setN((x) => x + 1);
  };

  const regenerate = () => {
    if (ui.length < 2) return;
    // remove the last question/answer from the UI, then resend that question
    const last = ui.filter((m) => m.role === "user").at(-1)!;
    const base = ui.slice(0, ui.lastIndexOf(last));
    setUi(base);
    send(base, server, last.text, false, n);
    setN((x) => x + 1);
  };

  const drift = server.length !== ui.length;

  const col = (title: string, msgs: Msg[], tone: string) => (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-ink">
        {title} <span className="font-normal text-ink-faint">({msgs.length})</span>
      </p>
      <ul className="mt-2 min-h-[9rem] space-y-1.5 rounded-xl border border-line bg-code/40 p-2.5">
        {msgs.map((m, i) => {
          const orphan = title === "Server memory" && i >= ui.length && drift;
          return (
            <li
              key={i}
              className="rounded-lg px-2.5 py-1.5 text-xs"
              style={{
                background: orphan ? "var(--stop-soft)" : m.role === "user" ? tone : "var(--surface)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
              }}
            >
              <span className="text-ink-faint">{m.role === "user" ? "You" : "Assistant"}: </span>
              {m.text}
              {orphan && <span style={{ color: "var(--stop)" }}> (out of sync)</span>}
            </li>
          );
        })}
        {msgs.length === 0 && <li className="px-1 py-2 text-xs text-ink-faint">empty</li>}
      </ul>
    </div>
  );

  return (
    <div className="docs-figure p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => ask(false)} className="rounded-full bg-accent px-4 py-1.5 text-sm text-white">
          Ask a question
        </button>
        <button onClick={() => ask(true)} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink hover:bg-line/50">
          Ask, then press Stop
        </button>
        <button
          onClick={regenerate}
          disabled={ui.length < 2}
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink hover:bg-line/50 disabled:opacity-40"
        >
          Regenerate last
        </button>
        <button
          onClick={() => {
            setUi([]);
            setServer([]);
            setN(1);
            setNote("Ask a question to begin.");
          }}
          aria-label="Reset"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint hover:bg-line/60"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} className="accent-[var(--accent)]" />
        The UI sends <code className="docs-code-inline">keep_messages</code> with every question
      </label>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        {col("What the UI shows", ui, "var(--flow-soft)")}
        {col("Server memory", server, "var(--data-soft)")}
      </div>

      <p className="mt-4 text-sm text-ink-soft" role="status" aria-live="polite">
        {note}
        {!sync && drift && " With keep_messages off, the stale reply stays in the model's context on every later turn."}
      </p>
    </div>
  );
}
