"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Command as CommandIcon, MessageSquare, PanelLeft, Plus, Workflow, Moon, Sparkles } from "lucide-react";
import { sendQuery } from "@/lib/api";
import { chatStore, uid, useChatStore } from "@/lib/store";
import { toggleTheme } from "@/lib/theme";
import { toast } from "@/lib/toast";
import type { ChatMessage, Feedback } from "@/lib/types";
import EmptyState from "./EmptyState";
import MessageView from "./Message";
import Pipeline from "./Pipeline";
import Composer, { type ComposerHandle } from "./Composer";
import GraphDialog from "./GraphDialog";
import Sidebar from "./Sidebar";
import CommandPalette, { type Command } from "./CommandPalette";
import ThemeToggle from "./ThemeToggle";
import Toaster from "./Toaster";

const SUGGESTED = [
  "How does Kubernetes handle pod networking?",
  "Summarize the key points of our Intel documentation",
  "What are best practices for network segmentation?",
];

export default function Chat() {
  const { hydrated, conversations, activeId } = useChatStore();
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = useMemo(() => active?.messages ?? [], [active]);

  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const loading = !!activeId && loadingIds.includes(activeId);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [showDown, setShowDown] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const stick = useRef(true);

  const scrollToBottom = useCallback((force = false, smooth = true) => {
    const el = scrollRef.current;
    if (!el || (!force && !stick.current)) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    stick.current = true;
    scrollToBottom(true, false);
  }, [activeId, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stick.current = near;
    setShowDown(!near);
  };

  /* ───────── actions ───────── */

  const ask = useCallback(
    async (text: string, opts?: { convId?: string; skipUser?: boolean }) => {
      const q = text.trim();
      if (!q) return;
      const convId = opts?.convId ?? chatStore.state().activeId ?? chatStore.create();
      if (controllers.current.has(convId)) return;

      if (!opts?.skipUser) chatStore.append(convId, { id: uid(), role: "user", content: q });
      stick.current = true;

      const controller = new AbortController();
      controllers.current.set(convId, controller);
      setLoadingIds((ids) => [...ids, convId]);
      const started = performance.now();
      const threadId = chatStore.state().conversations.find((c) => c.id === convId)?.threadId ?? uid();

      try {
        const data = await sendQuery(q, threadId, controller.signal);
        const failed = data.status === "error";
        chatStore.append(convId, {
          id: uid(),
          role: "assistant",
          content: data.answer ?? "I couldn't produce an answer.",
          thought: data.thought_process ?? [],
          status: data.status ?? undefined,
          sources: data.sources ?? [],
          error: failed,
          fresh: !failed,
          question: q,
          durationMs: Math.round(performance.now() - started),
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          chatStore.append(convId, {
            id: uid(),
            role: "assistant",
            content:
              "I couldn't reach the server. Make sure the API is running on the configured URL and try again.",
            error: true,
            question: q,
          });
        }
      } finally {
        controllers.current.delete(convId);
        setLoadingIds((ids) => ids.filter((i) => i !== convId));
      }
    },
    [],
  );

  const stop = useCallback(() => {
    const id = chatStore.state().activeId;
    if (id) controllers.current.get(id)?.abort();
  }, []);

  const retry = useCallback(
    (msg: ChatMessage) => {
      const id = chatStore.state().activeId;
      const conv = chatStore.state().conversations.find((c) => c.id === id);
      if (!id || !conv || !msg.question) return;
      const idx = conv.messages.findIndex((m) => m.id === msg.id);
      if (idx < 0) return;
      chatStore.truncate(id, idx);
      void ask(msg.question, { convId: id, skipUser: true });
    },
    [ask],
  );

  const edit = useCallback(
    (msg: ChatMessage, text: string) => {
      const id = chatStore.state().activeId;
      const conv = chatStore.state().conversations.find((c) => c.id === id);
      if (!id || !conv) return;
      const idx = conv.messages.findIndex((m) => m.id === msg.id);
      if (idx < 0) return;
      chatStore.truncate(id, idx);
      void ask(text, { convId: id });
    },
    [ask],
  );

  const feedback = useCallback((msg: ChatMessage, f: Feedback | undefined) => {
    const id = chatStore.state().activeId;
    if (id) chatStore.patchMessage(id, msg.id, { feedback: f });
  }, []);

  const typed = useCallback((msg: ChatMessage) => {
    const id = chatStore.state().activeId;
    if (id) chatStore.patchMessage(id, msg.id, { fresh: false });
  }, []);

  const newChat = useCallback(() => {
    chatStore.select(null);
    setMobileOpen(false);
    setTimeout(() => composerRef.current?.focus(), 0);
  }, []);

  const deleteChat = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    const snap = chatStore.remove(id);
    if (snap) toast("Chat deleted", { label: "Undo", run: () => chatStore.restore(snap) });
  }, []);

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setSidebarOpen((o) => !o);
    else setMobileOpen((o) => !o);
  }, []);

  /* ───────── command palette ───────── */

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: "new", label: "New chat", group: "Actions", hint: "⌘⇧O", icon: Plus, run: newChat },
      { id: "sidebar", label: "Toggle sidebar", group: "Actions", hint: "⌘B", icon: PanelLeft, run: toggleSidebar },
      { id: "theme", label: "Toggle light / dark theme", group: "Actions", icon: Moon, run: toggleTheme },
      { id: "graph", label: "Show agent workflow", group: "Actions", icon: Workflow, run: () => setGraphOpen(true) },
    ];
    const prompts: Command[] = SUGGESTED.map((p, i) => ({
      id: `prompt-${i}`,
      label: p,
      group: "Try asking",
      icon: Sparkles,
      run: () => {
        chatStore.select(null);
        void ask(p);
      },
    }));
    const chats: Command[] = [...conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => ({
        id: `chat-${c.id}`,
        label: c.title,
        group: "Chats",
        icon: MessageSquare,
        run: () => chatStore.select(c.id),
      }));
    return [...base, ...chats, ...prompts];
  }, [conversations, newChat, toggleSidebar, ask]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "/" && !["TEXTAREA", "INPUT"].includes(document.activeElement?.tagName ?? "")) {
        e.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat, toggleSidebar]);

  /* ───────── render ───────── */

  const empty = hydrated && messages.length === 0 && !loading;
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;

  return (
    <div className="relative flex h-dvh overflow-hidden">
      <div className="wash" aria-hidden>
        <i />
        <i />
      </div>

      <Sidebar
        open={sidebarOpen}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => chatStore.select(id)}
        onNew={newChat}
        onRename={chatStore.rename}
        onPin={chatStore.togglePin}
        onDelete={deleteChat}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 flex items-center gap-2 border-b border-line/60 px-3 py-2.5 sm:px-5">
          <button
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-line/60 hover:text-ink"
          >
            <PanelLeft size={17} />
          </button>
          <span className="min-w-0 flex-1 truncate font-serif text-lg font-semibold tracking-tight">
            {active?.title && active.title !== "New chat" ? active.title : "Enterprise Assistant"}
          </span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-ink-faint transition hover:border-accent/40 hover:text-ink sm:flex"
          >
            <CommandIcon size={13} /> Search or jump to… <kbd>⌘K</kbd>
          </button>
          <button
            onClick={() => setGraphOpen(true)}
            aria-label="View agent workflow"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-line/60 hover:text-ink"
          >
            <Workflow size={16} />
          </button>
          <button
            onClick={newChat}
            aria-label="New chat"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-line/60 hover:text-ink md:hidden"
          >
            <Plus size={17} />
          </button>
          <ThemeToggle />
        </header>

        <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
            {empty ? (
              <EmptyState onPick={(q) => ask(q)} />
            ) : (
              <div className="space-y-10 pt-8">
                {messages.map((m) => (
                  <MessageView
                    key={m.id}
                    message={m}
                    isLastUser={m.id === lastUserId}
                    busy={loading}
                    onRetry={retry}
                    onRegenerate={retry}
                    onEdit={edit}
                    onFeedback={feedback}
                    onTyped={typed}
                    onTyping={() => scrollToBottom()}
                  />
                ))}
                {loading && <Pipeline />}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showDown && !empty && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => scrollToBottom(true)}
              aria-label="Scroll to latest message"
              className="card absolute bottom-36 left-1/2 z-20 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full text-ink-soft shadow-[var(--shadow-md)] hover:text-accent"
            >
              <ArrowDown size={16} />
            </motion.button>
          )}
        </AnimatePresence>

        <Composer ref={composerRef} onSend={(q) => ask(q)} onStop={stop} busy={loading} />
      </div>

      <CommandPalette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
      <GraphDialog open={graphOpen} onClose={() => setGraphOpen(false)} />
      <Toaster />
    </div>
  );
}
