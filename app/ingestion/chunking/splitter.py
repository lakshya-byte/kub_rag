from typing import List, Optional
import numpy as np
import logfire
import re

from app.services.retrieval.embeddings import get_embeddings

# Semantic chunking involves taking the embeddings of every sentence in the document,
# comparing the similarity of all sentences with each other, and then grouping sentences with the most similar embeddings together.

# 1. Split the documents into sentences based on separators(.,?,!)
# 2. Index each sentence based on position.
# 3. Group: Choose how many sentences to be on either side. Add a buffer of sentences on either side of our selected sentence.
# 4. Calculate distance between group of sentences.
# 5. Merge groups based on similarity i.e. keep similar sentences together.
# 6. Split the sentences that are not similar.


# When we choose a breakpoint_threshold=0.3:

# 1) The model calculates the embedding for each sentence.

# 2) It then checks the distance between consecutive sentences using (1 - cosine similarity).

# 3) If this value is greater than 0.3, it indicates a significant semantic shift, and a new chunk begins at that point.

# This method ensures that chunks are split based on the actual meaning and context of the content, rather than arbitrary length limits, leading to more coherent and relevant chunks for retrieval.

# Note on the threshold: with text-embedding-3-small even closely related neighbouring sentences are
# often 0.3-0.6 apart, so a fixed absolute 0.3 cuts almost every sentence into its own chunk.
# By default the breakpoint is therefore a *percentile of this document's own distances*
# (only the biggest jumps start a new chunk), and chunks are kept at least `min_chunk_size` long.


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Return the cosine similarity between two embedding vectors."""
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def _normalize_text(text: str) -> str:
    """
    Undo hard line wraps (typical of PDF extraction) without merging real paragraphs:
    a newline is turned into a space only when the line does not end a sentence and the
    next line starts in lower case.
    """
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"(?<=[^\s.!?:;])\n(?=[a-z(\[])", " ", text)


def _split_into_sentences(text: str) -> List[str]:
    """
    Naively split text into sentences on '.', '!', '?' boundaries and on blank lines
    (paragraph breaks). Strips blank results.
    """
    raw = re.split(r"(?<=[.!?])\s+|\n\s*\n", _normalize_text(text).strip())
    return [s.strip() for s in raw if s and s.strip()]


def _group_sentences(
    sentences: List[str],
    distances: List[float],
    threshold: float,
    min_chunk_size: int,
    max_chunk_size: int,
) -> List[str]:
    """
    Group consecutive sentences into chunks. `distances[i-1]` is the distance between
    sentence i-1 and sentence i. A new chunk starts when the distance exceeds `threshold`
    AND the current chunk already has at least `min_chunk_size` characters, or when adding
    the sentence would exceed `max_chunk_size`. A too-short final chunk is merged back
    into the previous one when the result still fits.
    """
    chunks: List[str] = []
    current: List[str] = [sentences[0]]
    current_length = len(sentences[0])

    for i in range(1, len(sentences)):
        sentence_len = len(sentences[i])
        would_exceed_max = (current_length + 1 + sentence_len) > max_chunk_size
        semantic_break = distances[i - 1] > threshold and current_length >= min_chunk_size

        if semantic_break or would_exceed_max:
            chunks.append(" ".join(current))
            current = [sentences[i]]
            current_length = sentence_len
        else:
            current.append(sentences[i])
            current_length += 1 + sentence_len

    if current:
        tail = " ".join(current)
        if chunks and len(tail) < min_chunk_size and len(chunks[-1]) + 1 + len(tail) <= max_chunk_size:
            chunks[-1] = chunks[-1] + " " + tail
        else:
            chunks.append(tail)

    return [c.strip() for c in chunks if c.strip()]


def chunk_text(
    text: str,
    breakpoint_threshold: Optional[float] = None,  # absolute cosine-distance override (None = use percentile)
    max_chunk_size: int = 1500,
    breakpoint_percentile: float = 85,
    min_chunk_size: int = 300,
) -> List[str]:
    """
    Semantic chunker that groups sentences by meaning rather than by a fixed
    character window.

    Strategy
    --------
    1. Split the document into sentences (after undoing hard line wraps).
    2. Embed every sentence with OpenAI ``text-embedding-3-small``.
    3. Compute the cosine *distance* (1 − similarity) between each consecutive
       pair of sentences.
    4. Start a new chunk at the largest jumps: distances above the
       ``breakpoint_percentile`` of this document's own distances (or above
       ``breakpoint_threshold`` if you pass an absolute value), but never before the
       current chunk has ``min_chunk_size`` characters.
    5. Respect ``max_chunk_size`` so a chunk never becomes too large for the retriever.

    Args:
        text: The raw input text to be chunked.
        breakpoint_threshold: Optional absolute cosine-distance threshold. When given it
            overrides ``breakpoint_percentile``.
        max_chunk_size: Hard ceiling on chunk length in characters. Default 1500.
        breakpoint_percentile: Percentile (0-100) of the document's consecutive-sentence
            distances used as the split threshold. Higher = fewer, larger chunks.
        min_chunk_size: Minimum chunk length in characters before a semantic split is allowed.

    Returns:
        A list of non-empty text chunks (empty list for empty input).
    """
    with logfire.span(
        "✂️ Semantic Chunking",
        text_length=len(text),
        breakpoint_threshold=breakpoint_threshold,
        breakpoint_percentile=breakpoint_percentile,
        min_chunk_size=min_chunk_size,
        max_chunk_size=max_chunk_size,
    ):
        if not text.strip():
            logfire.info("⚠️ Empty text received — returning no chunks")
            return []

        sentences = _split_into_sentences(text)
        logfire.info(f"🔤 Split into {len(sentences)} sentences")

        if len(sentences) == 1:
            return [sentences[0]]

        logfire.info("🔢 Embedding sentences via OpenAI...")
        vectors = get_embeddings().embed_documents(sentences)
        embeddings = [np.array(v) for v in vectors]

        distances = [
            1.0 - _cosine_similarity(embeddings[i - 1], embeddings[i])
            for i in range(1, len(embeddings))
        ]
        threshold = (
            breakpoint_threshold
            if breakpoint_threshold is not None
            else float(np.percentile(distances, breakpoint_percentile))
        )

        valid_chunks = _group_sentences(sentences, distances, threshold, min_chunk_size, max_chunk_size)
        logfire.info(f"✅ Generated {len(valid_chunks)} semantic chunks (threshold={threshold:.3f})")
        return valid_chunks
