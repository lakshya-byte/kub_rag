"use client";

import { useSyncExternalStore } from "react";
import type { ChatMessage, Conversation } from "./types";

const KEY = "rag-chats-v1";

type State = { hydrated: boolean; conversations: Conversation[]; activeId: string | null };

const SERVER: State = { hydrated: false, conversations: [], activeId: null };
let state: State = SERVER;
let initialized = false;
const listeners = new Set<() => void>();

export const uid = () => crypto.randomUUID();

const MAX_STORED_CHATS = 50;     // unpinned chats kept (pinned chats are always kept)
const CHATS_WITH_SOURCES = 10;   // newest chats that keep their (large) source text

/** Build the copy that is written to localStorage: capped in size, never the in-memory state. */
function snapshot(maxChats: number, withSources: number): Conversation[] {
  const byRecent = [...state.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const unpinned = byRecent.filter((c) => !c.pinned).slice(0, maxChats);
  const keepIds = new Set([...byRecent.filter((c) => c.pinned), ...unpinned].map((c) => c.id));
  const recentIds = new Set(byRecent.slice(0, withSources).map((c) => c.id));

  return state.conversations
    .filter((c) => keepIds.has(c.id))
    .map((c) => ({
      ...c,
      messages: c.messages.map(({ fresh: _fresh, sources, sourceMeta, ...m }) => {
        void _fresh;
        // Sources are the bulkiest part of a chat: keep them only for the newest chats.
        return recentIds.has(c.id) ? { ...m, sources, sourceMeta } : m;
      }),
    }));
}

function persist() {
  const write = (conversations: Conversation[]) =>
    localStorage.setItem(KEY, JSON.stringify({ conversations, activeId: state.activeId }));
  try {
    write(snapshot(MAX_STORED_CHATS, CHATS_WITH_SOURCES));
  } catch {
    // Most likely the ~5 MB quota: retry with a much smaller footprint.
    try {
      write(snapshot(20, 0));
    } catch {}
  }
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const conversations: Conversation[] = Array.isArray(p.conversations) ? p.conversations : [];
      const activeId = conversations.some((c) => c.id === p.activeId) ? p.activeId : null;
      state = { hydrated: true, conversations, activeId };
      return;
    }
  } catch {}
  state = { ...SERVER, hydrated: true };
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

function mapConv(id: string, fn: (c: Conversation) => Conversation) {
  set({ conversations: state.conversations.map((c) => (c.id === id ? fn(c) : c)) });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => {
  init();
  return state;
};
const getServerSnapshot = () => SERVER;

export const useChatStore = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

export const chatStore = {
  state: () => {
    init();
    return state;
  },
  create(): string {
    const now = Date.now();
    const c: Conversation = {
      id: uid(),
      threadId: uid(),
      title: "New chat",
      pinned: false,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    set({ conversations: [c, ...state.conversations], activeId: c.id });
    return c.id;
  },
  select(id: string | null) {
    set({ activeId: id });
  },
  append(id: string, msg: ChatMessage) {
    mapConv(id, (c) => ({
      ...c,
      title:
        c.title === "New chat" && msg.role === "user"
          ? msg.content.slice(0, 48) + (msg.content.length > 48 ? "…" : "")
          : c.title,
      updatedAt: Date.now(),
      messages: [...c.messages, msg],
    }));
  },
  patchMessage(id: string, msgId: string, patch: Partial<ChatMessage>) {
    mapConv(id, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
    }));
  },
  /** drop every message from index `from` onward */
  truncate(id: string, from: number) {
    mapConv(id, (c) => ({ ...c, messages: c.messages.slice(0, from) }));
  },
  rename(id: string, title: string) {
    const t = title.trim();
    if (t) mapConv(id, (c) => ({ ...c, title: t }));
  },
  togglePin(id: string) {
    mapConv(id, (c) => ({ ...c, pinned: !c.pinned }));
  },
  remove(id: string): { conv: Conversation; index: number } | null {
    const index = state.conversations.findIndex((c) => c.id === id);
    if (index < 0) return null;
    const conv = state.conversations[index];
    set({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeId: state.activeId === id ? null : state.activeId,
    });
    return { conv, index };
  },
  restore(snap: { conv: Conversation; index: number }) {
    const list = [...state.conversations];
    list.splice(Math.min(snap.index, list.length), 0, snap.conv);
    set({ conversations: list, activeId: snap.conv.id });
  },
};
