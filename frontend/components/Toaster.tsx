"use client";

import { AnimatePresence, motion } from "framer-motion";
import { dismissToast, useToasts } from "@/lib/toast";

export default function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="pointer-events-auto flex items-center gap-4 rounded-full bg-ink px-5 py-2.5 text-sm text-paper shadow-[var(--shadow-lg)]"
          >
            {t.message}
            {t.action && (
              <button
                onClick={() => {
                  t.action?.run();
                  dismissToast(t.id);
                }}
                className="font-medium text-[#f0a37f] hover:underline"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
