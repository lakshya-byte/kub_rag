"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { API_URL } from "@/lib/api";

/** Mounted only while the dialog is open, so its error state resets on every open. */
function GraphImage() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="rounded-xl border border-line bg-paper p-4 text-sm text-ink-soft">
        The workflow diagram couldn&apos;t be loaded. Make sure the API is running and can reach
        mermaid.ink (the diagram is rendered online), then try again.
      </p>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${API_URL}/graph`}
      alt="LangGraph workflow diagram"
      onError={() => setFailed(true)}
      className="mx-auto rounded-xl bg-white"
    />
  );
}

export default function GraphDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.96, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Agent workflow"
            className="relative max-h-[90dvh] w-full max-w-lg overflow-auto rounded-3xl border border-line bg-surface p-6"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-faint hover:bg-line/60 hover:text-ink"
            >
              <X size={16} />
            </button>
            <h2 className="mb-4 font-serif text-xl font-semibold">Agent workflow</h2>
            <GraphImage />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
