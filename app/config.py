import os
from dotenv import load_dotenv

load_dotenv()


def require(*names: str) -> None:
    """Fail fast with one clear message when required environment variables are missing."""
    missing = [n for n in names if not os.getenv(n)]
    if missing:
        raise RuntimeError(
            "Missing environment variables: " + ", ".join(missing)
            + ". Add them to .env (see .env.example)."
        )


class settings:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GROQ_MODEL = os.getenv("GROQ_MODEL")
    GUARDRAILS_MODEL = os.getenv("GUARDRAILS_MODEL", "openai/gpt-oss-safeguard-20b")

    QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
    QDRANT_CLUSTER_ENDPOINT = os.getenv("QDRANT_CLUSTER_ENDPOINT")
    QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

    PORTKEY_API_KEY = os.getenv("PORTKEY_API_KEY")
    GROQ_SLUG = os.getenv("GROQ_SLUG")
    GROQ_SLUG_2 = os.getenv("GROQ_SLUG_2")
    PORTKEY_CONFIG = os.getenv("PORTKEY_CONFIG")

    LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY")
    LANGSMITH_ENDPOINT = os.getenv("LANGSMITH_ENDPOINT")
    LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT")

    # Comma-separated list of browser origins allowed to call the API.
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if o.strip()
    ]

    # Minimum Qdrant similarity score for a chunk to count as relevant context.
    RETRIEVAL_MIN_SCORE = float(os.getenv("RETRIEVAL_MIN_SCORE", "0.2"))

    # SQLite file that stores LangGraph conversation memory (survives restarts).
    CHAT_DB_PATH = os.getenv("CHAT_DB_PATH", "chat_memory.db")


settings = settings()
