"use client";

import { useState } from "react";

type Cand = { src: string; text: string; score: number; rerank: number };

/** Illustrative candidates (15 per query, as the retriever requests). */
const QUERIES: { id: string; q: string; note: string; cands: Cand[] }[] = [
  {
    id: "cron",
    q: "What is a Kubernetes CronJob?",
    note: "On-topic: real matches score high and the cutoff barely matters.",
    cands: [
      { src: "cronjobs.docx", text: "A CronJob creates Jobs on a repeating schedule.", score: 0.84, rerank: 0.97 },
      { src: "cronjobs.docx", text: "Schedule uses the standard cron format.", score: 0.77, rerank: 0.91 },
      { src: "job_management.html", text: "Jobs run Pods until a set number complete.", score: 0.69, rerank: 0.74 },
      { src: "cronjobs.docx", text: "concurrencyPolicy controls overlapping runs.", score: 0.66, rerank: 0.83 },
      { src: "monitor_job.docx", text: "Check CronJob history with kubectl get jobs.", score: 0.61, rerank: 0.7 },
      { src: "job_management.html", text: "Delete finished Jobs to free resources.", score: 0.52, rerank: 0.42 },
      { src: "architecture.pptx", text: "Control plane components schedule workloads.", score: 0.47, rerank: 0.31 },
      { src: "parallel_work_queue.txt", text: "Work queues fan tasks out to workers.", score: 0.44, rerank: 0.28 },
      { src: "architecture.pptx", text: "Nodes run kubelet and a container runtime.", score: 0.39, rerank: 0.2 },
      { src: "monitor_job.docx", text: "Events show why a Pod failed to start.", score: 0.36, rerank: 0.18 },
      { src: "architecture.pptx", text: "Masters coordinate all worker nodes.", score: 0.31, rerank: 0.12 },
      { src: "job_management.html", text: "Labels select which Pods belong to a Job.", score: 0.29, rerank: 0.14 },
      { src: "parallel_work_queue.txt", text: "Use a shared queue service for tasks.", score: 0.26, rerank: 0.1 },
      { src: "architecture.pptx", text: "Overview of the cluster components.", score: 0.23, rerank: 0.08 },
      { src: "monitor_job.docx", text: "Backoff limit caps retries of a Job.", score: 0.21, rerank: 0.11 },
    ],
  },
  {
    id: "coffee",
    q: "how to make coffee",
    note: "Off-topic: nothing is truly relevant, but one-line fragments still score above the default 0.2.",
    cands: [
      { src: "extensible-cpp-framework.pdf", text: "Step 2.", score: 0.33, rerank: 0.21 },
      { src: "extensible-cpp-framework.pdf", text: "The steps themselves are: Step 1.", score: 0.31, rerank: 0.19 },
      { src: "extensible-cpp-framework.pdf", text: "Step 10.", score: 0.3, rerank: 0.18 },
      { src: "extensible-cpp-framework.pdf", text: "Step 3.", score: 0.29, rerank: 0.17 },
      { src: "extensible-cpp-framework.pdf", text: "Step 6.", score: 0.28, rerank: 0.16 },
      { src: "architecture.pptx", text: "Agenda: Introduction, Who am I?", score: 0.25, rerank: 0.09 },
      { src: "architecture.pptx", text: "Kubernetes v1.8 overview.", score: 0.24, rerank: 0.08 },
      { src: "job_management.html", text: "Preparation of the Job spec.", score: 0.23, rerank: 0.07 },
      { src: "monitor_job.docx", text: "Make sure the Pod is running.", score: 0.22, rerank: 0.06 },
      { src: "cronjobs.docx", text: "Run the command below.", score: 0.21, rerank: 0.05 },
      { src: "architecture.pptx", text: "Questions?", score: 0.19, rerank: 0.04 },
      { src: "monitor_job.docx", text: "Thank you.", score: 0.17, rerank: 0.03 },
      { src: "job_management.html", text: "See the appendix.", score: 0.15, rerank: 0.03 },
      { src: "parallel_work_queue.txt", text: "Example.", score: 0.13, rerank: 0.02 },
      { src: "cronjobs.docx", text: "Notes.", score: 0.11, rerank: 0.02 },
    ],
  },
];

export default function Retrieval() {
  const [qi, setQi] = useState(0);
  const [cut, setCut] = useState(0.2);
  const q = QUERIES[qi];
  const pass = q.cands.filter((c) => c.score >= cut);
  const kept = [...pass].sort((a, b) => b.rerank - a.rerank).slice(0, 5);
  const keptSet = new Set(kept);

  return (
    <div className="docs-figure p-4 sm:p-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Example question">
        {QUERIES.map((x, i) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={i === qi}
            onClick={() => setQi(i)}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              i === qi ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-soft hover:border-accent/40"
            }`}
          >
            {x.q}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-soft">{q.note}</p>

      <label className="mt-5 block text-sm">
        <span className="flex justify-between text-ink-soft">
          <span>Minimum score (RETRIEVAL_MIN_SCORE)</span>
          <span className="tabular-nums text-ink">{cut.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={0.9}
          step={0.01}
          value={cut}
          onChange={(e) => setCut(+e.target.value)}
          className="docs-range mt-3"
          aria-label="Minimum similarity score"
        />
      </label>

      <ol className="mt-5 space-y-1.5" aria-label="Retrieved candidates">
        {q.cands.map((c, i) => {
          const ok = c.score >= cut;
          const isKept = keptSet.has(c);
          return (
            <li
              key={i}
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-2 py-1 text-xs transition-opacity sm:grid-cols-[14rem_1fr_5.5rem]"
              style={{ opacity: ok ? 1 : 0.35 }}
            >
              <span className="hidden truncate text-ink-faint sm:block">{c.src}</span>
              <span className="relative block h-6 overflow-hidden rounded-md bg-line/40">
                <span
                  className="absolute inset-y-0 left-0 rounded-md"
                  style={{ width: `${c.score * 100}%`, background: isKept ? "var(--flow)" : ok ? "var(--data)" : "var(--ink-faint)", opacity: 0.8 }}
                />
                <span className="relative z-10 block truncate px-2 leading-6 text-ink">{c.text}</span>
              </span>
              <span className="text-right tabular-nums text-ink-soft">
                {c.score.toFixed(2)}
                {isKept && <span className="ml-1 text-accent">kept</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid grid-cols-3 gap-3 text-center" aria-live="polite">
        {[
          ["Candidates", q.cands.length],
          ["Above cutoff", pass.length],
          ["Sent to the model", kept.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-code/50 p-3">
            <p className="text-xs text-ink-faint">{k}</p>
            <p className="mt-0.5 font-serif text-2xl text-ink">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-soft">
        {kept.length === 0
          ? "Nothing passes, so the responder returns its fixed “couldn't find anything relevant” message and makes no model call."
          : qi === 1
            ? "These fragments are why an off-topic question once got an answer. Raising the cutoff, cleaning the data and refusing the question earlier all remove it."
            : `${kept.length} passages, each with its file name and score, go to the model.`}
      </p>
      <p className="mt-1 text-xs text-ink-faint">Scores here are illustrative, not measured.</p>
    </div>
  );
}
