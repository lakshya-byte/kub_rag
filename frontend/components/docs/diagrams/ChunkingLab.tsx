"use client";

import { useMemo, useState } from "react";

/** Illustrative sentences: [chars, distance to the previous sentence]. Three topics (pods, jobs, networking). */
const SENTENCES: [number, number][] = [
  [92, 0], [118, 0.08], [74, 0.1], [131, 0.07], [96, 0.12],
  [88, 0.46], [140, 0.09], [102, 0.11], [67, 0.08], [123, 0.13], [95, 0.1],
  [110, 0.1], [84, 0.52], [127, 0.08], [99, 0.12], [76, 0.09], [134, 0.11],
  [91, 0.07], [105, 0.58], [120, 0.1], [83, 0.13], [137, 0.09], [98, 0.28],
  [72, 0.12], [115, 0.1],
];

const MAX = 1500;

function percentile(values: number[], p: number) {
  const s = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

function chunk(threshold: number, minSize: number) {
  const out: number[][] = [];
  let cur: number[] = [];
  let size = 0;
  SENTENCES.forEach(([len, dist], i) => {
    const split = i > 0 && ((dist > threshold && size >= minSize) || size + len > MAX);
    if (split) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(i);
    size += len;
  });
  if (cur.length) out.push(cur);
  return out;
}

const PALETTE = ["var(--flow)", "var(--data)", "var(--guard)", "var(--ok)", "#c58a1b"];

export default function ChunkingLab() {
  const [pct, setPct] = useState(85);
  const [minSize, setMinSize] = useState(300);
  const [fixed, setFixed] = useState(false);

  const dists = SENTENCES.slice(1).map((s) => s[1]);
  const threshold = fixed ? 0.05 : percentile(dists, pct);
  const chunks = useMemo(() => chunk(threshold, fixed ? 0 : minSize), [threshold, minSize, fixed]);
  const sizes = chunks.map((c) => c.reduce((n, i) => n + SENTENCES[i][0], 0));
  const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
  const chunkOf = new Map<number, number>();
  chunks.forEach((c, ci) => c.forEach((i) => chunkOf.set(i, ci)));

  const W = 760;
  const H = 150;
  const bw = W / SENTENCES.length;
  const y = (d: number) => H - 14 - (d / 0.7) * (H - 30);

  return (
    <div className="docs-figure p-4 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="flex justify-between text-ink-soft">
            <span>Cut at the top percentile of distances</span>
            <span className="tabular-nums text-ink">{fixed ? "n/a" : `${pct}th`}</span>
          </span>
          <input
            type="range"
            min={50}
            max={99}
            value={pct}
            disabled={fixed}
            onChange={(e) => setPct(+e.target.value)}
            className="docs-range mt-3 disabled:opacity-40"
            aria-label="Breakpoint percentile"
          />
        </label>
        <label className="block text-sm">
          <span className="flex justify-between text-ink-soft">
            <span>Minimum chunk size</span>
            <span className="tabular-nums text-ink">{fixed ? "none" : `${minSize} chars`}</span>
          </span>
          <input
            type="range"
            min={0}
            max={800}
            step={50}
            value={minSize}
            disabled={fixed}
            onChange={(e) => setMinSize(+e.target.value)}
            className="docs-range mt-3 disabled:opacity-40"
            aria-label="Minimum chunk size"
          />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} className="accent-[var(--accent)]" />
        Show the old behaviour: a fixed, very low distance threshold and no minimum size
      </label>

      <div className="mt-5 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H + 26}`} className="min-w-[36rem]" role="img" aria-label="Distance between consecutive sentences, coloured by chunk">
          <line x1="0" x2={W} y1={y(threshold)} y2={y(threshold)} stroke="var(--stop)" strokeDasharray="5 4" strokeWidth="1.5" />
          <text x={W - 4} y={y(threshold) - 5} textAnchor="end" className="dg-text" fontSize="11" fill="var(--stop)" style={{ fill: "var(--stop)" }}>
            cut line {threshold.toFixed(2)}
          </text>
          {SENTENCES.map(([, d], i) => (
            <rect
              key={i}
              x={i * bw + 2}
              y={y(d)}
              width={bw - 4}
              height={H - 14 - y(d)}
              rx={3}
              fill={PALETTE[(chunkOf.get(i) ?? 0) % PALETTE.length]}
              opacity={0.9}
            />
          ))}
          {SENTENCES.map(([, ], i) => (
            <rect key={`c${i}`} x={i * bw + 2} y={H} width={bw - 4} height={8} rx={2} fill={PALETTE[(chunkOf.get(i) ?? 0) % PALETTE.length]} />
          ))}
          <text x="0" y={H + 22} className="dg-text dg-faint" fontSize="11">
            Each bar is a sentence (height = how far its meaning jumped). The strip below shows its chunk.
          </text>
        </svg>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        {[
          ["Chunks", String(chunks.length)],
          ["Average size", `${avg} chars`],
          ["Smallest", `${Math.min(...sizes)} chars`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-code/50 p-3">
            <dt className="text-xs text-ink-faint">{k}</dt>
            <dd className="mt-0.5 font-serif text-2xl text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm text-ink-soft">
        {fixed
          ? "A threshold below the document's normal sentence-to-sentence distance cuts nearly every sentence, so chunks are tiny and lose context."
          : "Because the cut line is a percentile of this document's own distances, it adapts to dense or loose writing. Lower it and you get more, smaller chunks."}
      </p>
    </div>
  );
}
