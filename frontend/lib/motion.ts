import type { MouseEvent } from "react";

export const ease = [0.22, 1, 0.36, 1] as const;
export const spring = { type: "spring", stiffness: 420, damping: 34 } as const;

/** Feeds --mx/--my so `.spot` surfaces can render a cursor-following glow. */
export function spotlight(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}
