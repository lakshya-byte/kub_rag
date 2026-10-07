"use client";

import { useEffect, useRef } from "react";

type RGB = [number, number, number];
type Palette = { a: RGB; b: RGB; dark: boolean };

const GOLD: RGB = [217, 164, 65];

function parseColor(v: string, fallback: RGB): RGB {
  const s = v.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!hex) return fallback;
  let h = hex[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const accent = parseColor(cs.getPropertyValue("--accent"), [232, 130, 90]);
  const paper = parseColor(cs.getPropertyValue("--paper"), [22, 20, 18]);
  const dark = (paper[0] * 299 + paper[1] * 587 + paper[2] * 114) / 1000 < 128;
  return { a: accent, b: GOLD, dark };
}

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (x: RGB, y: RGB, t: number): RGB => [
  x[0] + (y[0] - x[0]) * t,
  x[1] + (y[1] - x[1]) * t,
  x[2] + (y[2] - x[2]) * t,
];

const LAYERS = 6;

/** Draws layered silk-like ribbons. t is seconds; pointer is in 0..1 viewport units (or null). */
function drawWaves(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  pointer: { x: number; y: number } | null,
  p: Palette,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = p.dark ? "lighter" : "source-over";
  const step = Math.max(6, Math.round(w / 160));

  for (let i = 0; i < LAYERS; i++) {
    const k = i / (LAYERS - 1); // 0 = back, 1 = front
    const base = h * (0.52 + k * 0.4);
    const amp = h * (0.05 + k * 0.045);
    const speed = 0.16 + k * 0.1;
    const phase = i * 1.7;
    const color = mix(p.a, p.b, 1 - k);

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + step; x += step) {
      const u = x / w;
      let y =
        base +
        Math.sin(u * 3.1 + t * speed + phase) * amp +
        Math.sin(u * 5.7 - t * speed * 1.3 + phase * 0.6) * amp * 0.45 +
        Math.sin(u * 1.3 + t * speed * 0.6 + phase * 2.1) * amp * 0.8;
      if (pointer) {
        const d = u - pointer.x;
        y -= Math.exp(-(d * d) / 0.02) * amp * 0.9 * (0.4 + pointer.y);
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const top = base - amp * 1.6;
    const g = ctx.createLinearGradient(0, top, 0, h);
    const peak = p.dark ? 0.13 + k * 0.05 : 0.09 + k * 0.05;
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(0.18, rgba(color, peak));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fill();

    // a thin crest line gives each ribbon its silk edge
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(color, p.dark ? 0.22 : 0.16);
    ctx.stroke();
  }
}

/**
 * Animated wave backdrop for the start screen. While `active` it animates; when it turns false the
 * loop stops on the current frame (a static still) and the canvas fades to a quiet level.
 */
export default function WaveBackground({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const drawNow = useRef<() => void>(() => {});
  const raf = useRef(0);

  // keep the latest value readable from the long-lived listeners without re-subscribing them
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // one-time setup: sizing, palette, pointer, visibility
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let palette = readPalette();
    let w = 0;
    let h = 0;
    let clock = 3; // seconds of wave time; frozen when inactive
    let last = 0;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, seen: false };

    const render = () => drawWaves(ctx, w, h, clock, pointer.seen ? pointer : null, palette);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    };

    const frame = (now: number) => {
      raf.current = 0;
      if (!activeRef.current || reduce.matches || document.hidden) return;
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      clock += dt;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      render();
      raf.current = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf.current || !activeRef.current || reduce.matches || document.hidden) return;
      last = 0;
      raf.current = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = 1 - e.clientY / window.innerHeight;
      pointer.seen = true;
    };
    const refreshPalette = () => {
      palette = readPalette();
      render();
    };

    drawNow.current = start;
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    const themeObs = new MutationObserver(refreshPalette);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", refreshPalette);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", start);
    reduce.addEventListener("change", start);

    resize();
    start();

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      ro.disconnect();
      themeObs.disconnect();
      scheme.removeEventListener("change", refreshPalette);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", start);
      reduce.removeEventListener("change", start);
    };
  }, []);

  // resume when a new chat brings the start screen back; the loop stops itself when `active` goes false
  useEffect(() => {
    if (active) drawNow.current();
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      style={{ opacity: active ? 1 : 0.35, transition: "opacity 700ms ease" }}
    />
  );
}
