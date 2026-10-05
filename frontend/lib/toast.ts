"use client";

import { useSyncExternalStore } from "react";

export type Toast = {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
};

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit() {
  listeners.forEach((l) => l());
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, action?: Toast["action"]) {
  const id = nextId++;
  toasts = [...toasts, { id, message, action }];
  emit();
  setTimeout(() => dismissToast(id), action ? 6000 : 2500);
}

export const useToasts = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );
