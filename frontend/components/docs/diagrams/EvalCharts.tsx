"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

const METRICS = [
  { id: "faith", name: "Faithfulness", needs: ["answer", "retrieved contexts"], judge: true, q: "Is every claim in the answer supported by the retrieved passages?", low: "The model is adding facts that are not in the documents." },
  { id: "rel", name: "Answer relevancy", needs: ["question", "answer"], judge: true, q: "Does the answer actually address what was asked?", low: "The answer is off target, padded or evasive." },
  { id: "prec", name: "Context precision", needs: ["question", "retrieved contexts", "reference"], judge: true, q: "Are the useful passages ranked near the top of what was retrieved?", low: "Retrieval or reranking is burying the good chunks under noise." },
  { id: "rec", name: "Context recall", needs: ["retrieved contexts", "reference"], judge: true, q: "Did retrieval fetch everything needed to produce the reference answer?", low: "Chunks are too small, the cutoff is too strict or documents are missing." },
  { id: "corr", name: "Answer correctness", needs: ["answer", "reference"], judge: true, q: "How close is the answer to the hand-written reference?", low: "Wrong or incomplete answer. Look at faithfulness and recall to see which half failed." },
  { id: "tool", name: "Tool correctness", needs: ["expected tools", "tools actually called"], judge: false, q: "Did the system take the expected path: retrieval for technical questions, guardrails for refusals?", low: "Routing is wrong, for example a greeting that triggered a search." },
];

function Stepper({ label, value, set, hint }: { label: string; value: number; set: (n: number) => void; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-code/40 p-3">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="text-xs text-ink-faint">{hint}</p>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => set(Math.max(0, value - 1))} aria-label={`Decrease ${label}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-line hover:bg-line/60">
          <Minus size={13} />
        </button>
        <span className="w-8 text-center font-serif text-xl tabular-nums text-ink">{value}</span>
        <button onClick={() => set(value + 1)} aria-label={`Increase ${label}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-line hover:bg-line/60">
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${Math.round((n / d) * 100)}%`);

export default function EvalCharts() {
  const [mi, setMi] = useState(0);
  const [tp, setTp] = useState(3);
  const [fn, setFn] = useState(1);
  const [fp, setFp] = useState(0);
  const [tn, setTn] = useState(2);
  const [err, setErr] = useState(0);
  const m = METRICS[mi];
  const scored = tp + fn + fp + tn;

  const cell = (v: number, label: string, good: boolean) => (
    <div
      className="flex flex-col items-center justify-center rounded-xl p-4 text-center"
      style={{ background: good ? "var(--ok-soft)" : "var(--stop-soft)", minHeight: "5.5rem" }}
    >
      <span className="font-serif text-3xl tabular-nums text-ink">{v}</span>
      <span className="text-xs text-ink-soft">{label}</span>
    </div>
  );

  return (
    <div className="docs-figure space-y-8 p-4 sm:p-6">
      <section aria-label="Metric explorer">
        <p className="text-sm font-medium text-ink">The six experiments</p>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {METRICS.map((x, i) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={i === mi}
              onClick={() => setMi(i)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                i === mi ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-soft hover:border-accent/40"
              }`}
            >
              {x.name}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-line bg-code/50 p-4" aria-live="polite">
          <p className="font-serif text-xl text-ink">{m.q}</p>
          <p className="mt-3 text-sm text-ink-soft">
            <span className="font-medium text-ink">Needs: </span>
            {m.needs.join(", ")}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            <span className="font-medium text-ink">Judge: </span>
            {m.judge ? "an LLM judge scores it from 0 to 1" : "no model calls, a direct comparison"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            <span className="font-medium text-ink">A low score usually means: </span>
            {m.low}
          </p>
        </div>
      </section>

      <section aria-label="Guardrail confusion matrix">
        <p className="text-sm font-medium text-ink">Scoring the guardrails: play with the counts</p>
        <p className="mt-1 text-sm text-ink-soft">
          “Positive” means the message should be blocked. Change the counts and watch the three scores move.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-center text-xs text-ink-faint">
              <span />
              <span>Blocked</span>
              <span>Allowed</span>
              <span className="[writing-mode:vertical-rl] rotate-180">Should block</span>
              {cell(tp, "caught (TP)", true)}
              {cell(fn, "missed (FN)", false)}
              <span className="[writing-mode:vertical-rl] rotate-180">Should allow</span>
              {cell(fp, "wrongly blocked (FP)", false)}
              {cell(tn, "allowed (TN)", true)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stepper label="TP" value={tp} set={setTp} hint="harmful, blocked" />
            <Stepper label="FN" value={fn} set={setFn} hint="harmful, let through" />
            <Stepper label="FP" value={fp} set={setFp} hint="fine, blocked" />
            <Stepper label="TN" value={tn} set={setTn} hint="fine, allowed" />
            <div className="col-span-2">
              <Stepper label="Errors" value={err} set={setErr} hint="request failed: excluded from every score" />
            </div>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["Precision", pct(tp, tp + fp), "of blocks that were right"],
            ["Recall", pct(tp, tp + fn), "of bad messages caught"],
            ["Accuracy", pct(tp + tn, scored), "of all scored cases"],
          ].map(([k, v, d]) => (
            <div key={k} className="rounded-xl border border-line bg-code/50 p-3">
              <dt className="text-xs text-ink-faint">{k}</dt>
              <dd className="font-serif text-2xl text-ink">{v}</dd>
              <dd className="text-[11px] text-ink-faint">{d}</dd>
            </div>
          ))}
        </dl>
        {err > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
            {err} errored case{err > 1 ? "s are" : " is"} shown separately. An outage is never counted as a correct block or a miss.
          </p>
        )}
      </section>
    </div>
  );
}
