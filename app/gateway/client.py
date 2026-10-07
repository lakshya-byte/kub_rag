import logfire
from portkey_ai import Portkey, createHeaders, PORTKEY_GATEWAY_URL
from langchain_openai import ChatOpenAI

from app.config import require, settings

# Fail fast: without these the gateway builds model names like '@None/...' and every call 401s.
require("PORTKEY_API_KEY", "GROQ_SLUG", "GROQ_SLUG_2")


# Production gateway config:
#   - Fallback: primary @rag/openai/gpt-oss-120b → @brag/openai/gpt-oss-120b on failure
#   - Cache: semantic mode (requires Portkey Enterprise — silently falls back to simple on free/starter)
#   - Retry: 2 attempts on rate limit / server error before triggering the fallback target

GATEWAY_CONFIG = {
    "strategy": {"mode": "fallback"},
    "cache": {"mode": "simple"},
    "retry": {
        "attempts": 2,
        "on_status_codes": [429, 503]
    },
    "targets": [
        {"override_params": {"model": f"@{settings.GROQ_SLUG}/openai/gpt-oss-120b"}},
        {"override_params": {"model": f"@{settings.GROQ_SLUG_2}/openai/gpt-oss-120b"}},
    ]
}

# Prefer a config saved in the Portkey dashboard (PORTKEY_CONFIG=pc-...); inline configs are
# rejected by workspaces that disable them ("Reference a saved config by its 'pc-...' slug").
ACTIVE_CONFIG = settings.PORTKEY_CONFIG or GATEWAY_CONFIG

portkey_client = Portkey(
    api_key=settings.PORTKEY_API_KEY,
    config=ACTIVE_CONFIG
)


def get_langchain_llm(feature: str = "rag") -> ChatOpenAI:
    """
    Returns a Portkey-backed ChatOpenAI — a drop-in for ChatGroq in LangChain nodes.

    Why ChatOpenAI and not ChatGroq:
      Portkey is a proxy. It exposes an OpenAI-compatible endpoint at PORTKEY_GATEWAY_URL.
      ChatGroq is hardwired to Groq's API and does not support routing through a proxy.
      ChatOpenAI supports base_url (points at Portkey) and default_headers (passes Portkey
      auth + config). The @rag/model-name format is Portkey-specific — Groq's own client
      does not understand it. You are still using Groq models; Portkey is just in the middle.
    """
    return ChatOpenAI(
        api_key=settings.PORTKEY_API_KEY,
        base_url=PORTKEY_GATEWAY_URL,
        model=f"@{settings.GROQ_SLUG}/openai/gpt-oss-120b",
        temperature=0,
        default_headers=createHeaders(
            api_key=settings.PORTKEY_API_KEY,
            config=ACTIVE_CONFIG,
            metadata={
                "feature": feature,
                "_user": "rag-system",
                "environment": "production"
            }
        )
    )

def extract_cache_status(response) -> str:
    """
    Read the Portkey cache status ('HIT' / 'MISS' / 'DISABLED') from a chat completion.

    The Portkey SDK exposes response headers through get_headers(), which returns only the
    x-portkey-* headers with that prefix removed, so the cache header is keyed 'cache-status'.
    Returns 'MISS' when the header is absent.
    """
    try:
        headers = response.get_headers() or {}
    except Exception:
        headers = {}
    status = headers.get("cache-status") or headers.get("x-portkey-cache-status") or ""
    return status.upper() if status else "MISS"
