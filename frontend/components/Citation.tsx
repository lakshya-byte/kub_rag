"use client";

export default function Citation({
  n,
  snippet,
  onJump,
}: {
  n: number;
  snippet?: string;
  onJump: (n: number) => void;
}) {
  return (
    <span className="group relative mx-0.5 inline-block align-baseline">
      <button
        type="button"
        onClick={() => onJump(n)}
        aria-label={`Jump to source ${n}`}
        className="inline-flex h-[1.35em] min-w-[1.35em] -translate-y-[0.15em] items-center justify-center rounded-md border border-accent/30 bg-accent-soft px-1 font-sans text-[0.68em] font-semibold leading-none text-accent transition hover:bg-accent hover:text-paper"
      >
        {n}
      </button>
      {snippet && (
        <span
          role="tooltip"
          className="pop pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-72 max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-xl border border-line bg-surface p-3 font-sans text-xs font-normal leading-relaxed text-ink-soft shadow-[var(--shadow-lg)] group-focus-within:block group-hover:block"
        >
          <span className="eyebrow mb-1 block">Source {n}</span>
          <span className="line-clamp-5 block">{snippet}</span>
        </span>
      )}
    </span>
  );
}
