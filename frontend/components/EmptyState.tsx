"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Network, Boxes, ShieldCheck } from "lucide-react";
import { ease, spotlight } from "@/lib/motion";

const PROMPTS = [
  { icon: Boxes, tag: "Kubernetes", text: "How does Kubernetes handle pod networking?" },
  { icon: Network, tag: "Intel", text: "Summarize the key points of our Intel documentation" },
  { icon: ShieldCheck, tag: "Networking", text: "What are best practices for network segmentation?" },
];

export default function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex min-h-[64dvh] flex-col justify-center pt-8">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="eyebrow mb-5"
      >
        Enterprise knowledge · grounded answers
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease }}
        className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-7xl"
      >
        What would you
        <br />
        like <em className="bg-gradient-to-r from-accent to-[#d9a441] bg-clip-text pr-1 text-transparent">to know?</em>
      </motion.h1>

      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {PROMPTS.map((p, i) => (
          <motion.button
            key={p.text}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 + i * 0.09, duration: 0.6, ease }}
            whileHover={{ y: -3 }}
            onMouseMove={spotlight}
            onClick={() => onPick(p.text)}
            className="spot card group flex min-h-36 flex-col justify-between rounded-3xl p-5 text-left transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-[var(--shadow-md)]"
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-medium text-accent">
                <p.icon size={14} /> {p.tag}
              </span>
              <ArrowUpRight
                size={16}
                className="text-ink-faint transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
              />
            </span>
            <span className="font-serif text-lg leading-snug text-ink">{p.text}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
