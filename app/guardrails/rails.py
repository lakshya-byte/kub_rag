import logfire

from app.config import settings
from app.guardrails.classifier import PASS, RESPONSES, classify


def initialize_rails() -> None:
    """
    Startup hook (kept so the API lifespan doesn't change). The classifier client is created lazily
    on first use, so there is nothing heavy to load here any more (NeMo's embedding index is gone).
    """
    logfire.info(f"🛡️ Guardrail classifier ready ({settings.GUARDRAILS_MODEL}).")


def guard(message: str) -> tuple[bool, str | None]:
    """
    Run a user message through the guardrail gate.

    Returns:
        (True,  reply) — the message was refused or answered by a rail; return `reply` immediately
                         and skip the RAG pipeline entirely.
        (False, None)  — the message is a normal technical request; proceed to LangGraph.
    """
    with logfire.span("🛡️ Guardrails Check"):
        label = classify(message)

        if label == PASS:
            logfire.info("✅ Guardrails passed.")
            return False, None

        logfire.info(f"🛡️ Guardrails fired | label={label} | query='{message[:80]}'")
        return True, RESPONSES[label]
