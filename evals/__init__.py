from evals.pipeline import run_pipeline, load_golden_dataset
from evals.guardrails_eval import run_guardrails_eval, compute_guardrails_metrics


async def run_all_metrics(*args, **kwargs):
    """Lazy wrapper: ragas is heavy and version-sensitive, so it is imported only when metrics run."""
    from evals.metrics import run_all_metrics as _run_all_metrics

    return await _run_all_metrics(*args, **kwargs)
