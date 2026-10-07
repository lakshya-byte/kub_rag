"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { SCENARIOS, STAGES, type StageState } from "@/docs/scenarios";

const COLOR: Record<StageState, string> = {
  run: "var(--flow)",
  skip: "var(--ink-faint)",
  stop: "var(--guard)",
};

/** mode "tracer": click a question and it plays by itself. mode "detailed": step with controls and a latency waterfall. */
export default function Lifecycle({ mode }: { mode: "tracer" | "detailed" }) {
  const [si, setSi] = useState(0);
  const [step, setStep] = useState(0); // number of stages revealed (0..5)
  const [playing, setPlaying] = useState(mode === "tracer");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sc = SCENARIOS[si];

  const stopAtIdx = STAGES.findIndex((s) => sc.stages[s.id].state === "stop");
  const last = stopAtIdx >= 0 ? stopAtIdx + 1 : STAGES.length; // stages that actually matter

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= last) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, 650);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, last]);

  const pick = (i: number) => {
    setSi(i);
    setStep(0);
    setPlaying(mode === "tracer" ? true : false);
  };

  const active = Math.min(Math.max(step - 1, 0), STAGES.length - 1);
  const shown = STAGES[active];
  const res = sc.stages[shown.id];
  const total = STAGES.reduce((n, s) => n + sc.stages[s.id].ms, 0);
  const offsets = STAGES.reduce<number[]>((o, st, i) => [...o, (o[i - 1] ?? 0) + (i ? sc.stages[STAGES[i - 1].id].ms : 0)], []);

  return (
    <div className="docs-figure p-4 sm:p-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Example questions">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === si}
            onClick={() => pick(i)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              i === si ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-soft hover:border-accent/40"
            }`}
          >
            {s.question}
          </button>
        ))}
      </div>

      <ol className="mt-6 grid grid-cols-5 gap-1.5 sm:gap-3" aria-label="Pipeline stages">
        {STAGES.map((s, i) => {
          const r = sc.stages[s.id];
          const reached = i < step;
          const current = i === active && step > 0;
          const dim = r.state === "skip" && reached;
          return (
            <li key={s.id} className="min-w-0">
              <button
                onClick={() => {
                  setPlaying(false);
                  setStep(i + 1);
                }}
                aria-current={current ? "step" : undefined}
                className="w-full rounded-xl border p-2 text-left transition sm:p-3"
                style={{
                  borderColor: reached ? COLOR[r.state] : "var(--line)",
                  background: current ? `color-mix(in srgb, ${COLOR[r.state]} 12%, transparent)` : "transparent",
                  opacity: dim ? 0.55 : 1,
                  boxShadow: current ? `0 0 0 2px color-mix(in srgb, ${COLOR[r.state]} 35%, transparent)` : "none",
                }}
              >
                <span className="block text-[10px] font-medium leading-tight text-ink sm:text-sm">{s.label}</span>
                <span
                  className="mt-1 line-clamp-2 break-words text-[9px] leading-tight sm:text-xs"
                  style={{ color: reached ? COLOR[r.state] : "var(--ink-faint)" }}
                >
                  {reached ? r.out : "waiting"}
                </span>
              </button>
              <div
                className="mx-auto mt-1.5 h-1 rounded-full transition-all duration-500"
                style={{
                  width: reached ? "100%" : "18%",
                  background: reached ? COLOR[r.state] : "var(--line)",
                }}
              />
            </li>
          );
        })}
      </ol>

      <div className="mt-5 min-h-[7.5rem] rounded-2xl border border-line bg-code/60 p-4" aria-live="polite">
        {step === 0 ? (
          <p className="text-sm text-ink-faint">
            {mode === "tracer" ? "Pick a question above." : "Press play or the next arrow to send the question."}
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">
              {shown.label}
              <span className="ml-2 break-all font-normal text-ink-faint">{shown.file}</span>
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{res.why}</p>
            {step >= last && (
              <p className="mt-3 text-sm font-medium text-ink">
                Result: <span className="font-normal text-ink-soft">{sc.outcome}</span>
              </p>
            )}
          </>
        )}
      </div>

      {mode === "detailed" && (
        <>
          <div className="mt-4 flex items-center gap-1.5">
            <button
              onClick={() => {
                setPlaying(false);
                setStep((s) => Math.max(0, s - 1));
              }}
              aria-label="Previous stage"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-line/60"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => {
                if (step >= last) setStep(0);
                setPlaying((p) => !p);
              }}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm text-white"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
              {playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setStep((s) => Math.min(last, s + 1));
              }}
              aria-label="Next stage"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-soft hover:bg-line/60"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setStep(0);
              }}
              aria-label="Reset"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-faint hover:bg-line/60"
            >
              <RotateCcw size={15} />
            </button>
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium text-ink">
              Where the time goes <span className="font-normal text-ink-faint">(illustrative, about {(total / 1000).toFixed(1)} s)</span>
            </p>
            <div className="mt-3 space-y-1.5" role="img" aria-label="Latency waterfall by stage">
              {STAGES.map((s, i) => {
                const r = sc.stages[s.id];
                const left = total ? (offsets[i] / total) * 100 : 0;
                const width = total ? Math.max((r.ms / total) * 100, r.ms ? 1.5 : 0) : 0;
                return (
                  <div key={s.id} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-xs">
                    <span className="truncate text-ink-soft">{s.label}</span>
                    <div className="relative h-3.5 rounded-full bg-line/50">
                      <div
                        className="absolute top-0 h-full rounded-full transition-all duration-500"
                        style={{
                          left: `${left}%`,
                          width: i < step ? `${width}%` : "0%",
                          background: COLOR[r.state],
                        }}
                      />
                    </div>
                    <span className="text-right tabular-nums text-ink-faint">{r.ms ? `${r.ms} ms` : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
