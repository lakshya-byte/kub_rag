"""
Guardrails binary evaluation.
Sends each test input to the live /query API and checks if the guardrail fired.
Classifies each result as TP / TN / FP / FN and computes precision + recall.
"""


import time
import copy
import uuid
import requests
import logfire

from evals.config import API_URL


def _is_blocked(response_json: dict) -> bool:
    tp = response_json.get("thought_process") or []
    return any("guardrails fired" in step.lower() for step in tp)


def run_guardrails_eval(guardrails_samples: list, progress_callback=None) -> list:
    """
    Runs each guardrails test case against the live API.
    Adds actual_blocked and result (TP/TN/FP/FN) to each sample in place.
    Returns the enriched list.
    """
    samples = copy.deepcopy(guardrails_samples)
    n = len(samples)
    run_id = uuid.uuid4().hex[:8]   # fresh server-side conversation for every sample and run

    with logfire.span("🛡️ Eval — Guardrails Tests", total=n):
        for i, sample in enumerate(samples):
            if progress_callback:
                progress_callback(i, n, sample["input"])

            with logfire.span(
                f"🛡️ Test {sample['id']}",
                input_text=sample["input"][:80],
                expected_blocked=sample["expected_blocked"],
            ):
                try:
                    resp = requests.post(
                        API_URL,
                        json={"q": sample["input"], "thread_id": f"guardrail_eval_{run_id}_{i}"},
                        timeout=30,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    if data.get("status") == "error":
                        raise RuntimeError("API returned an error response")
                    blocked = _is_blocked(data)

                except Exception as e:
                    # A failed request is NOT a prediction: never score it as a pass or a block.
                    logfire.error(f"❌ Guardrails test error (not scored): {e}")
                    sample["actual_blocked"] = None
                    sample["result"] = "ERROR"
                    time.sleep(2)
                    continue

                expected = sample["expected_blocked"]
                sample["actual_blocked"] = blocked

                if expected and blocked:
                    sample["result"] = "TP"
                elif expected and not blocked:
                    sample["result"] = "FN"
                elif not expected and not blocked:
                    sample["result"] = "TN"
                else:
                    sample["result"] = "FP"

                logfire.info(
                    f"🛡️ {sample['result']}",
                    expected_blocked=expected,
                    actual_blocked=blocked,
                    input_preview=sample["input"][:60],
                )

            time.sleep(2)

    return samples


def compute_guardrails_metrics(results: list) -> dict:
    """Precision / recall / accuracy over the *scored* results. ERROR results are excluded and counted."""
    errors = sum(1 for r in results if r["result"] == "ERROR")
    scored = [r for r in results if r["result"] != "ERROR"]

    tp = sum(1 for r in scored if r["result"] == "TP")
    tn = sum(1 for r in scored if r["result"] == "TN")
    fp = sum(1 for r in scored if r["result"] == "FP")
    fn = sum(1 for r in scored if r["result"] == "FN")

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    accuracy  = (tp + tn) / len(scored) if scored else 0.0

    return {
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "accuracy": round(accuracy, 3),
        "total": len(scored),
        "errors": errors,
        "correct": tp + tn,
    }
