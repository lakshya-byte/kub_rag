import os
import time
import logfire
from langchain_openai import OpenAIEmbeddings
from app.config import settings

EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

_embeddings = None


def get_embeddings() -> OpenAIEmbeddings:
    """Return a shared LangChain OpenAIEmbeddings instance (usable directly with Qdrant vector stores)."""
    global _embeddings
    if _embeddings is None:
        if not settings.OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _embeddings = OpenAIEmbeddings(
            model=EMBEDDING_MODEL,
            api_key=settings.OPENAI_API_KEY,
        )
    return _embeddings


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of documents."""
    if not texts:
        return []

    start = time.perf_counter()
    with logfire.span("openai.embed_texts", model=EMBEDDING_MODEL, count=len(texts)):
        vectors = get_embeddings().embed_documents(texts)
    logfire.info(
        "Embedded {count} texts in {elapsed:.2f}s",
        count=len(texts),
        elapsed=time.perf_counter() - start,
    )
    return vectors


_embedding_dim = None


def get_embedding_dim() -> int:
    """Return the embedding vector size by probing the model once (cached)."""
    global _embedding_dim
    if _embedding_dim is None:
        _embedding_dim = len(get_embeddings().embed_query("dimension probe"))
    return _embedding_dim


def embed_query(text: str) -> list[float]:
    """Embed a single search query."""
    return get_embeddings().embed_query(text)
