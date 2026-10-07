"""
Phase 2 — RAGAS + Tool Correctness metrics.
Requires the JUDGE_GROQ key so the production GROQ_API_KEY is never used (or exhausted) by evals.
Rate limits are handled by retrying with exponential backoff on HTTP 429 and capping the
number of concurrent judge calls, instead of sleeping on a fixed schedule.
"""


import os
import re
import random
import asyncio
import logfire
import pandas as pd
from openai import AsyncOpenAI


from ragas.llms import llm_factory
from ragas.embeddings import HuggingFaceEmbeddings
from ragas import SingleTurnSample
from ragas.metrics.collections import (
    Faithfulness,
    AnswerRelevancy,
    ContextPrecision,
    ContextRecall,
    AnswerCorrectness,
)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
JUDGE_MODEL = "openai/gpt-oss-120b"
CONCURRENCY = 2          # max judge calls in flight at once
MAX_RETRIES = 6          # retries per judge call when rate limited (HTTP 429)
BACKOFF_BASE = 5.0       # seconds; doubles each retry (5, 10, 20, 40, 80 ...) plus jitter
BACKOFF_MAX = 90.0
CONTEXT_TRUNCATE = 1200  # chars per context chunk passed to the judge
CONTEXT_LIMIT = 5        # number of context chunks passed to RAGAS per sample (what the app really used)


def _build_judge():
    api_key = os.getenv("JUDGE_GROQ")
    if not api_key:
        raise RuntimeError(
            "JUDGE_GROQ is not set. Evals must use a separate Groq key so they never exhaust "
            "the production GROQ_API_KEY. Add JUDGE_GROQ to .env."
        )
    client = AsyncOpenAI(api_key=api_key, base_url=GROQ_BASE_URL)
    llm = llm_factory(JUDGE_MODEL, provider="openai", client=client)
    embeddings = HuggingFaceEmbeddings(
        model="sentence-transformers/all-MiniLM-L6-v2",
        use_api=False,
    )
    return llm, embeddings

def _is_rate_limit(exc: Exception) -> bool:
    text = f"{type(exc).__name__} {exc}".lower()
    return getattr(exc, "status_code", None) == 429 or "429" in text or "rate limit" in text or "ratelimit" in text


async def _with_retry(call, status_cb=None, label: str = ""):
    """Run `call()` (an async callable), retrying with exponential backoff while rate limited."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            return await call()
        except Exception as exc:
            if not _is_rate_limit(exc) or attempt == MAX_RETRIES:
                raise
            delay = min(BACKOFF_MAX, BACKOFF_BASE * (2 ** attempt)) + random.uniform(0, 1.5)
            if status_cb:
                status_cb(f"⏳ {label}: rate limited, retrying in {delay:.0f}s (attempt {attempt + 1}/{MAX_RETRIES})...")
            await asyncio.sleep(delay)


class _FailedScore:
    """Stand-in for a score that could not be computed (shown as NaN, ignored by the mean)."""
    value = float("nan")


def _prep_samples(golden_dataset: dict) -> list:
    """
    Returns only samples with actual_response populated.
    Contexts are capped at CONTEXT_LIMIT chunks of CONTEXT_TRUNCATE chars each
    (close to what the app really passed to the LLM) and the answer is NOT truncated.
    """
    valid = []
    for s in golden_dataset["rag_samples"]:
        response = (s.get("actual_response") or "").strip()
        if not response:
            continue
        raw_contexts = s.get("actual_contexts") or []
        contexts = [re.sub(r"^CONTENT:\s*", "", c)[:CONTEXT_TRUNCATE] for c in raw_contexts[:CONTEXT_LIMIT]]
        valid.append({**s, "actual_contexts": contexts})
    return valid


def _score_df(metric_key: str, samples: list, scores) -> pd.DataFrame:
    return pd.DataFrame([
        {"question": s["question"][:65], metric_key: round(float(r.value), 3) if r.value == r.value else float("nan")}
        for s, r in zip(samples, scores)
    ])


async def _batched_score(metric, inputs: list, samples: list, status_cb=None, label: str = "") -> list:
    """
    Scores every input with `metric`, at most CONCURRENCY at a time, retrying on rate limits.
    A sample that still fails after the retries is recorded as NaN instead of aborting the run.
    """
    sem = asyncio.Semaphore(CONCURRENCY)

    async def score_one(inp: dict):
        async with sem:
            try:
                scores = await _with_retry(lambda: metric.abatch_score([inp]), status_cb, label)
                return scores[0]
            except Exception as exc:
                logfire.error(f"{label}: scoring failed for '{str(inp.get('user_input'))[:50]}': {exc}")
                return _FailedScore()

    return list(await asyncio.gather(*(score_one(i) for i in inputs)))

async def run_all_metrics(golden_dataset: dict, status_cb=None) -> dict:
    """
    Runs all 6 experiments. Returns dict keyed by metric name → DataFrame.
    status_cb(message: str) is called for live UI updates.
    """
    judge_llm, ragas_embeddings = _build_judge()
    samples = _prep_samples(golden_dataset)

    if not samples:
        raise ValueError("No samples with actual_response found. Run Phase 1 first.")

    results = {}

    with logfire.span("🧪 Eval Phase 2 — All Metrics", total_samples=len(samples)):

        # ── Exp 1: Faithfulness ───────────────────────────────────────────────
        if status_cb:
            status_cb(f"🧪 Exp 1/6 — Faithfulness ({len(samples)} samples)...")
        with logfire.span("🧪 Exp 1 — Faithfulness"):
            inputs = [
                {
                    "user_input": s["question"],
                    "response": s["actual_response"],
                    "retrieved_contexts": s["actual_contexts"],
                }
                for s in samples
            ]
            scores = await _batched_score(Faithfulness(llm=judge_llm), inputs, samples, status_cb, "Faithfulness")
            df = _score_df("faithfulness", samples, scores)
            results["faithfulness"] = df
            logfire.info("🧪 Faithfulness done", avg=round(df["faithfulness"].mean(), 3))


        # ── Exp 2: Answer Relevancy ───────────────────────────────────────────
        if status_cb:
            status_cb(f"🧪 Exp 2/6 — Answer Relevancy ({len(samples)} samples)...")
        with logfire.span("🧪 Exp 2 — Answer Relevancy"):
            inputs = [
                {"user_input": s["question"], "response": s["actual_response"]}
                for s in samples
            ]
            scores = await _batched_score(
                AnswerRelevancy(llm=judge_llm, embeddings=ragas_embeddings),
                inputs, samples, status_cb, "Answer Relevancy"
            )
            df = _score_df("answer_relevancy", samples, scores)
            results["answer_relevancy"] = df
            logfire.info("🧪 Answer Relevancy done", avg=round(df["answer_relevancy"].mean(), 3))


        # ── Exp 3: Context Precision ──────────────────────────────────────────
        if status_cb:
            status_cb(f"🧪 Exp 3/6 — Context Precision ({len(samples)} samples)...")
        with logfire.span("🧪 Exp 3 — Context Precision"):
            inputs = [
                {
                    "user_input": s["question"],
                    "reference": s["reference"],
                    "retrieved_contexts": s["actual_contexts"],
                }
                for s in samples
            ]
            scores = await _batched_score(ContextPrecision(llm=judge_llm), inputs, samples, status_cb, "Context Precision")
            df = _score_df("context_precision", samples, scores)
            results["context_precision"] = df
            logfire.info("🧪 Context Precision done", avg=round(df["context_precision"].mean(), 3))


        # ── Exp 4: Context Recall ─────────────────────────────────────────────
        if status_cb:
            status_cb(f"🧪 Exp 4/6 — Context Recall ({len(samples)} samples)...")
        with logfire.span("🧪 Exp 4 — Context Recall"):
            inputs = [
                {
                    "user_input": s["question"],
                    "reference": s["reference"],
                    "retrieved_contexts": s["actual_contexts"],
                }
                for s in samples
            ]
            scores = await _batched_score(ContextRecall(llm=judge_llm), inputs, samples, status_cb, "Context Recall")
            df = _score_df("context_recall", samples, scores)
            results["context_recall"] = df
            logfire.info("🧪 Context Recall done", avg=round(df["context_recall"].mean(), 3))


        # ── Exp 5: Answer Correctness (split into batches) ────────────────────
        if status_cb:
            status_cb(f"🧪 Exp 5/6 — Answer Correctness batch 1/2...")
        with logfire.span("🧪 Exp 5 — Answer Correctness"):
            inputs = [
                {
                    "user_input": s["question"],
                    "response": s["actual_response"],
                    "reference": s["reference"],
                }
                for s in samples
            ]
            all_scores = await _batched_score(
                AnswerCorrectness(llm=judge_llm, embeddings=ragas_embeddings),
                inputs, samples, status_cb, "Answer Correctness"
            )
            df = _score_df("answer_correctness", samples, all_scores)
            results["answer_correctness"] = df
            logfire.info("🧪 Answer Correctness done", avg=round(df["answer_correctness"].mean(), 3))


        # ── Exp 6: Tool Correctness (no LLM — Jaccard) ───────────────────────
        if status_cb:
            status_cb("⚡ Exp 6/6 — Tool Correctness (zero LLM calls)...")
        with logfire.span("🧪 Exp 6 — Tool Correctness"):
            tool_rows = []
            for s in samples:
                called = set(s.get("actual_tools_called") or [])
                expected = set(s.get("expected_tools") or [])
                union = len(called | expected)
                score = len(called & expected) / union if union > 0 else 0.0
                tool_rows.append({"question": s["question"][:65], "tool_correctness": round(score, 3)})
            df = pd.DataFrame(tool_rows)
            results["tool_correctness"] = df
            logfire.info("🧪 Tool Correctness done", avg=round(df["tool_correctness"].mean(), 3))

        if status_cb:
            status_cb("✅ All 6 experiments complete!")

    return results
