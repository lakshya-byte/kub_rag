"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const KEY = "rag-theme";
const listeners = new Set<() => void>();

function read(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "dark" || explicit === "light") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  listeners.forEach((l) => l());
}

export const toggleTheme = () => setTheme(read() === "dark" ? "light" : "dark");

export const useTheme = (): Theme =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => "light",
  );

/** Inline script (runs before paint) to apply a saved theme with no flash. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;
