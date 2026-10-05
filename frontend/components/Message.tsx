"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Check, Copy, Pencil, RefreshCw, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import type { ChatMessage, Feedback } from "@/lib/types";
import { ease } from "@/lib/motion";
import Markdown from "./Markdown";
import ThoughtProcess from "./ThoughtProcess";
import Sources from "./Sources";

function useTypewriter(text: string, enabled: boolean, onTick: () => void) {
  const [shown, setShown] = useState(enabled ? 0 : text.length);
  const tick = useRef(onTick);
  useEffect(() => {
    tick.current = onTick;
  });

  useEffect(() => {
    if (!enabled) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // time-based (not tick-based) so throttled background timers don't slow the reveal
    const duration = reduce ? 0 : Math.min(3000, Math.max(700, text.length * 7));
    const start = performance.now();
    const t = setInterval(() => {
      const progress = duration === 0 ? 1 : Math.min(1, (performance.now() - start) / duration);
      let next = Math.floor(progress * text.length);
      // snap forward to the end of the current word so markdown/citations don't flicker
      while (next < text.length && progress < 1 && !/\s/.test(text[next])) next++;
      setShown(progress >= 1 ? text.length : next);
      if (progress >= 1) clearInterval(t);
      tick.current();
    }, 16);
    return () => clearInterval(t);
  }, [text, enabled]);

  return { text: text.slice(0, shown), done: shown >= text.length };
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-line/60 ${
        active ? "text-accent" : "text-ink-faint hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

type Props = {
  message: ChatMessage;
  isLastUser: boolean;
  busy: boolean;
  onRetry: (m: ChatMessage) => void;
  onRegenerate: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage, text: string) => void;
  onFeedback: (m: ChatMessage, f: Feedback | undefined) => void;
  onTyped: (m: ChatMessage) => void;
  onTyping: () => void;
};

export default function MessageView({
  message,
  isLastUser,
  busy,
  onRetry,
  onRegenerate,
  onEdit,
  onFeedback,
  onTyped,
  onTyping,
}: Props) {
  const isUser = message.role === "user";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [hl, setHl] = useState<number | null>(null);
  const { text, done } = useTypewriter(message.content, !!message.fresh && !isUser, onTyping);

  useEffect(() => {
    if (done && message.fresh) onTyped(message);
  }, [done, message, onTyped]);

  const jump = (n: number) => {
    setHl(n);
    document.getElementById(`${message.id}-src-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setHl(null), 2500);
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease }}
        className="group flex flex-col items-end gap-1"
      >
        {editing ? (
          <div className="w-full max-w-[85%] space-y-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(8, Math.max(2, draft.split("\n").length))}
              className="card w-full resize-none rounded-2xl p-4 text-[15px] outline-none focus:border-accent/50"
            />
            <div className="flex justify-end gap-2 text-sm">
              <button onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-line/60">
                Cancel
              </button>
              <button
                disabled={!draft.trim()}
                onClick={() => {
                  setEditing(false);
                  onEdit(message, draft);
                }}
                className="rounded-full bg-ink px-4 py-1.5 text-paper transition hover:bg-accent disabled:opacity-30"
              >
                Save &amp; resend
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-ink px-5 py-3 text-[15px] leading-relaxed text-paper shadow-[var(--shadow-md)]">
              {message.content}
            </div>
            {isLastUser && !busy && (
              <button
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-ink-faint opacity-0 transition hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                <Pencil size={11} /> Edit
              </button>
            )}
          </>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className="space-y-4"
    >
      {message.error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-5 py-4 text-[15px]">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-accent" />
          <div className="space-y-3">
            <p className="text-ink">{message.content}</p>
            {message.question && (
              <button
                onClick={() => onRetry(message)}
                className="flex items-center gap-1.5 rounded-full border border-accent/40 px-3 py-1 text-sm text-accent transition hover:bg-accent hover:text-paper"
              >
                <RotateCcw size={13} /> Try again
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {message.thought && message.thought.length > 0 && (
            <ThoughtProcess steps={message.thought} status={message.status} durationMs={message.durationMs} />
          )}
          <div className="prose-chat break-words">
            <Markdown text={text} sources={message.sources} onCite={jump} />
          </div>
          {done && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {message.sources && message.sources.length > 0 && (
                <Sources sources={message.sources} idPrefix={message.id} highlight={hl} />
              )}
              <div className="-ml-2 flex items-center gap-0.5">
                <IconButton
                  label={copied ? "Copied" : "Copy answer"}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(message.content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {}
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </IconButton>
                {!busy && (
                  <IconButton label="Regenerate" onClick={() => onRegenerate(message)}>
                    <RefreshCw size={15} />
                  </IconButton>
                )}
                <IconButton
                  label="Good answer"
                  active={message.feedback === "up"}
                  onClick={() => onFeedback(message, message.feedback === "up" ? undefined : "up")}
                >
                  <ThumbsUp size={15} />
                </IconButton>
                <IconButton
                  label="Bad answer"
                  active={message.feedback === "down"}
                  onClick={() => onFeedback(message, message.feedback === "down" ? undefined : "down")}
                >
                  <ThumbsDown size={15} />
                </IconButton>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
