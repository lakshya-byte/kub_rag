"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Pin, PinOff, Plus, Search, Trash2, X } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { spring } from "@/lib/motion";

type Handlers = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
};

const DAY = 86_400_000;

function groupOf(c: Conversation, startOfToday: number): string {
  if (c.pinned) return "Pinned";
  if (c.updatedAt >= startOfToday) return "Today";
  if (c.updatedAt >= startOfToday - DAY) return "Yesterday";
  if (c.updatedAt >= startOfToday - 7 * DAY) return "Previous 7 days";
  return "Older";
}
const ORDER = ["Pinned", "Today", "Yesterday", "Previous 7 days", "Older"];

function Item({
  c,
  active,
  onSelect,
  onRename,
  onPin,
  onDelete,
}: { c: Conversation; active: boolean } & Pick<Handlers, "onRename" | "onPin" | "onDelete"> & {
    onSelect: () => void;
  }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.title);
  const ref = useRef<HTMLInputElement>(null);

  const commit = () => {
    onRename(c.id, draft);
    setEditing(false);
  };

  return (
    <motion.li layout transition={spring} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
      <div
        className={`group relative flex items-center rounded-xl pr-1 transition-colors ${
          active ? "bg-accent-soft" : "hover:bg-line/50"
        }`}
      >
        {editing ? (
          <input
            ref={ref}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label="Rename chat"
            className="m-1 w-full rounded-lg border border-accent/50 bg-surface px-2 py-1.5 text-sm outline-none"
          />
        ) : (
          <>
            <button
              onClick={onSelect}
              onDoubleClick={() => {
                setDraft(c.title);
                setEditing(true);
              }}
              className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm ${
                active ? "font-medium text-ink" : "text-ink-soft"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {c.pinned && <Pin size={11} className="mr-1.5 inline -translate-y-px text-accent" />}
              {c.title}
            </button>
            <div className="flex shrink-0 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
              {[
                { l: "Rename", i: Pencil, f: () => (setDraft(c.title), setEditing(true)) },
                { l: c.pinned ? "Unpin" : "Pin", i: c.pinned ? PinOff : Pin, f: () => onPin(c.id) },
                { l: "Delete", i: Trash2, f: () => onDelete(c.id) },
              ].map((a) => (
                <button
                  key={a.l}
                  onClick={a.f}
                  aria-label={`${a.l} chat`}
                  title={a.l}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:bg-line hover:text-ink"
                >
                  <a.i size={13} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.li>
  );
}

function Panel(h: Handlers & { onClose?: () => void }) {
  const [q, setQ] = useState("");
  const [now] = useState(() => new Date().setHours(0, 0, 0, 0));

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = h.conversations
      .filter(
        (c) =>
          !needle ||
          c.title.toLowerCase().includes(needle) ||
          c.messages.some((m) => m.content.toLowerCase().includes(needle)),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const map = new Map<string, Conversation[]>();
    for (const c of list) {
      const g = groupOf(c, now);
      map.set(g, [...(map.get(g) ?? []), c]);
    }
    return ORDER.filter((g) => map.has(g)).map((g) => ({ name: g, items: map.get(g)! }));
  }, [h.conversations, q, now]);

  return (
    <div className="flex h-full w-72 flex-col">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => {
            h.onNew();
            h.onClose?.();
          }}
          className="flex flex-1 items-center gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm font-medium text-paper transition hover:bg-accent"
        >
          <Plus size={15} /> New chat
          <kbd className="ml-auto !border-paper/20 !bg-transparent !text-paper/60">⌘⇧O</kbd>
        </button>
        {h.onClose && (
          <button onClick={h.onClose} aria-label="Close sidebar" className="rounded-full p-2 text-ink-soft hover:bg-line/60">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="px-3 pb-2">
        <label className="card flex items-center gap-2 rounded-xl px-3 py-2 text-sm focus-within:border-accent/50">
          <Search size={14} className="text-ink-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="w-full bg-transparent outline-none placeholder:text-ink-faint"
          />
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Conversations">
        {groups.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-ink-faint">
            {q ? "No chats match your search." : "Your conversations will appear here."}
          </p>
        )}
        {groups.map((g) => (
          <section key={g.name} className="mb-3">
            <h3 className="eyebrow px-3 py-2">{g.name}</h3>
            <ul>
              <AnimatePresence initial={false}>
                {g.items.map((c) => (
                  <Item
                    key={c.id}
                    c={c}
                    active={c.id === h.activeId}
                    onSelect={() => {
                      h.onSelect(c.id);
                      h.onClose?.();
                    }}
                    onRename={h.onRename}
                    onPin={h.onPin}
                    onDelete={h.onDelete}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}

export default function Sidebar({
  open,
  mobileOpen,
  onCloseMobile,
  ...h
}: Handlers & { open: boolean; mobileOpen: boolean; onCloseMobile: () => void }) {
  return (
    <>
      {/* desktop: persistent, collapsible */}
      <motion.aside
        initial={false}
        animate={{ width: open ? 288 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="glass relative z-20 hidden shrink-0 overflow-hidden border-r border-line md:block"
        aria-hidden={!open}
        inert={!open}
      >
        <Panel {...h} />
      </motion.aside>

      {/* mobile: slide-over drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="glass absolute inset-y-0 left-0 border-r border-line bg-paper"
              style={{ background: "var(--paper)" }}
            >
              <Panel {...h} onClose={onCloseMobile} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
