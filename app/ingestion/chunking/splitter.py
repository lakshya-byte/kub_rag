from typing import List
import numpy as np
import logfire

from langchain_openai import OpenAIEmbeddings
from app.config import settings

# ---------------------------------------------------------------------------
# Embedding model initialised once at module load to avoid repeated cold-starts.
# Uses OpenAI's fast, cost-effective small embedding model.
# ---------------------------------------------------------------------------
_embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key=settings.OPENAI_API_KEY,
)


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Return the cosine similarity between two embedding vectors."""
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def _split_into_sentences(text: str) -> List[str]:
    """
    Naively split text into sentences on '.', '!', '?' boundaries.
    Strips blank results and preserves non-trivially short fragments.
    """
    import re
    # Split on sentence-ending punctuation followed by whitespace or end-of-string
    raw = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in raw if s.strip()]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chunk_text(
    text: str,
    breakpoint_threshold: float = 0.3,
    max_chunk_size: int = 1500,
) -> List[str]:
    """
    Semantic chunker that groups sentences by meaning rather than by a fixed
    character window.

    Strategy
    --------
    1. Split the document into individual sentences.
    2. Embed every sentence with OpenAI ``text-embedding-3-small``.
    3. Compute the cosine *distance* (1 − similarity) between each consecutive
       pair of sentences.
    4. Wherever the distance exceeds ``breakpoint_threshold``, start a new chunk
       — this signals a topic/semantic shift in the text.
    5. Additionally respect ``max_chunk_size`` so that a single chunk never
       becomes too large for the downstream retriever.

    Args:
        text: The raw input text to be chunked.
        breakpoint_threshold: Cosine-distance threshold (0–1) above which a new
            chunk begins. Lower values create more, finer-grained chunks; higher
            values create fewer, broader chunks. Default 0.3 works well in
            practice.
        max_chunk_size: Hard ceiling on chunk length in characters. If a
            semantically-coherent group would exceed this, it is split
            regardless of semantic similarity. Default 1500.

    Returns:
        A list of non-empty, semantically-coherent text chunks.

    Raises:
        ValueError: If the text is empty after stripping whitespace.
    """
    with logfire.span(
        "✂️ Semantic Chunking",
        text_length=len(text),
        breakpoint_threshold=breakpoint_threshold,
        max_chunk_size=max_chunk_size,
    ):
        # ------------------------------------------------------------------
        # 1. Guard: return immediately on empty input
        # ------------------------------------------------------------------
        if not text.strip():
            logfire.info("⚠️ Empty text received — returning no chunks")
            return []

        # ------------------------------------------------------------------
        # 2. Sentence splitting
        # ------------------------------------------------------------------
        sentences = _split_into_sentences(text)
        logfire.info(f"🔤 Split into {len(sentences)} sentences")

        # Edge-case: single sentence — return as-is (no pairwise comparison needed)
        if len(sentences) == 1:
            return [sentences[0]]

        # ------------------------------------------------------------------
        # 3. Batch-embed all sentences in one API call for efficiency
        # ------------------------------------------------------------------
        logfire.info("🔢 Embedding sentences via OpenAI...")
        vectors = _embeddings.embed_documents(sentences)
        embeddings = [np.array(v) for v in vectors]

        # ------------------------------------------------------------------
        # 4. Detect semantic breakpoints using consecutive cosine distances
        # ------------------------------------------------------------------
        chunks: List[str] = []
        current_sentences: List[str] = [sentences[0]]
        current_length: int = len(sentences[0])

        for i in range(1, len(sentences)):
            # Cosine distance between sentence i-1 and sentence i
            distance = 1.0 - _cosine_similarity(embeddings[i - 1], embeddings[i])

            sentence_len = len(sentences[i])
            would_exceed_max = (current_length + 1 + sentence_len) > max_chunk_size

            if distance > breakpoint_threshold or would_exceed_max:
                # -- Semantic shift detected OR hard size limit hit --
                # Flush the current accumulation as a finished chunk
                chunks.append(" ".join(current_sentences))
                current_sentences = [sentences[i]]
                current_length = sentence_len
            else:
                # -- Same topic: keep accumulating --
                current_sentences.append(sentences[i])
                current_length += 1 + sentence_len  # +1 for the space separator

        # ------------------------------------------------------------------
        # 5. Flush the last in-progress chunk
        # ------------------------------------------------------------------
        if current_sentences:
            chunks.append(" ".join(current_sentences))

        # ------------------------------------------------------------------
        # 6. Final hygiene: remove any accidentally empty strings
        # ------------------------------------------------------------------
        valid_chunks = [c.strip() for c in chunks if c.strip()]
        logfire.info(f"✅ Generated {len(valid_chunks)} semantic chunks")
        return valid_chunks

