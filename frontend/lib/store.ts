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

function persist() {
  try {
    const conversations = state.conversations.map((c) => ({
      ...c,
      // `fresh` is transient: never replay the typewriter after a reload
      messages: c.messages.map(({ fresh: _fresh, ...m }) => {
        void _fresh;
        return m;
      }),
    }));
    localStorage.setItem(KEY, JSON.stringify({ conversations, activeId: state.activeId }));
  } catch {}
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
