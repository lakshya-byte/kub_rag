"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

export type ComposerHandle = { focus: () => void };

const Composer = forwardRef<
  ComposerHandle,
  { onSend: (q: string) => void; onStop: () => void; busy: boolean }
>(function Composer({ onSend, onStop, busy }, ref) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => taRef.current?.focus() }));

  const resize = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const submit = () => {
    if (!value.trim() || busy) return;
    onSend(value);
    setValue("");
    requestAnimationFrame(resize);
  };

  return (
    <div className="relative z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="glass flex items-end gap-2 rounded-[28px] border border-line p-2 pl-5 shadow-[var(--shadow-lg),var(--hi)] transition focus-within:border-accent/60 focus-within:shadow-[var(--shadow-lg),0_0_0_4px_color-mix(in_srgb,var(--accent)_12%,transparent)]">
          <textarea
            ref={taRef}
            value={value}
            rows={1}
            autoFocus
            placeholder="Ask anything…"
            aria-label="Message"
            onChange={(e) => {
              setValue(e.target.value);
              resize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[200px] flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-relaxed outline-none placeholder:text-ink-faint"
          />
          {busy ? (
            <button
              onClick={onStop}
              aria-label="Stop generating"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-paper transition hover:opacity-85"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!value.trim()}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition enabled:hover:bg-accent enabled:hover:shadow-[0_6px_18px_-4px_var(--accent)] disabled:opacity-25"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-faint">
          Enter to send · Shift+Enter for a new line
          <span className="hidden sm:inline">
            {" "}
            · <kbd>⌘</kbd> <kbd>K</kbd> command palette
          </span>
        </p>
      </div>
    </div>
  );
});

export default Composer;
