import os
import sys
import uuid
import json
import logfire

from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.config import settings
from app.ingestion.loaders.pdf import parse_pdf
from app.ingestion.loaders.html import parse_html
from app.ingestion.loaders.text import parse_text
from app.ingestion.loaders.office import parse_office
from app.ingestion.chunking.splitter import chunk_text
from app.services.retrieval.embeddings import embed_texts, get_embedding_dim


logfire.configure(
    service_name="enterprise-ingestion-service",
    send_to_logfire="if-token-present",  # don't fail if Logfire isn't set up
)

# Local folder where parsed + chunked JSON metadata is saved (replaces GCS processed bucket)
PROCESSED_DATA_DIR = "processed_data"

# Initialize Qdrant Client
qdrant_client = QdrantClient(
    url=settings.QDRANT_CLUSTER_ENDPOINT,
    api_key=settings.QDRANT_API_KEY,
)

# Fixed namespace so the same (source, chunk) always maps to the same point ID.
# Re-running ingestion then overwrites points instead of creating duplicates.
POINT_NAMESPACE = uuid.UUID("3b1f7a52-6c1e-4d0b-9a55-2f7c8d9e1a10")

# Qdrant rejects very large requests, so upsert in batches.
UPSERT_BATCH_SIZE = 200


def point_id(source: str, chunk: str) -> str:
    """Deterministic point ID derived from the source filename and chunk text."""
    return str(uuid.uuid5(POINT_NAMESPACE, f"{source}\n{chunk}"))


def source_type_from_name(name: str, default: str) -> str:
    """Map a folder name to a source type: 'true' / 'noisy' by keyword, otherwise `default`."""
    lowered = name.lower()
    if "true" in lowered:
        return "true"
    if "noisy" in lowered:
        return "noisy"
    return default


def save_processed_locally(data: dict, source_type: str, filename: str) -> str:
    """
    Persists parsed and chunked document metadata to the local filesystem as a JSON file.

    This function acts as a local replacement for a cloud storage bucket (e.g., GCS).
    It organises output files under the PROCESSED_DATA_DIR root, further namespaced
    by source_type, so that different document categories remain cleanly separated.

    Parameters
    ----------
    data : dict
        A dictionary containing the processed document payload — typically including
        the original filename, source type label, and the list of text chunks.
    source_type : str
        A category label for the document (e.g. "true", "noisy", "general"). Used as
        a sub-folder name under PROCESSED_DATA_DIR to group related documents together.
    filename : str
        The base name of the source file (without extension) used as the output JSON
        filename. This ensures the saved file can be traced back to its original source.

    Returns
    -------
    str
        The absolute or relative path to the written JSON file, which can be logged
        or used by downstream steps to verify the save location.
    """
    folder = os.path.join(PROCESSED_DATA_DIR, source_type)
    os.makedirs(folder, exist_ok=True)
    dest = os.path.join(folder, f"{filename}.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return dest


def process_file(file_path: str, filename: str, source_type: str):
    """
    Executes the full ingestion pipeline for a single document file.

    This is the core processing function that orchestrates four sequential stages:

      1. **Parse** — Reads the raw file and extracts plain text using a format-specific
         loader (PDF, HTML, plain text, or Office documents). Unsupported file types are
         skipped with a warning and no error is raised.

      2. **Chunk** — Splits the extracted text into smaller, semantically meaningful
         segments using the configured chunking strategy. If no chunks are produced
         (e.g. the file is empty after parsing), the function exits early.

      3. **Save locally** — Serialises the chunk metadata (filename, source type, and
         chunk list) to a JSON file on disk via `save_processed_locally`, giving a
         persistent audit trail of everything that was fed into the vector store.

      4. **Embed & Index** — Generates dense vector embeddings for each chunk and
         upserts them as PointStruct records into the configured Qdrant collection,
         associating each vector with its source text and provenance metadata.

    All stages execute inside a logfire span so that latency, errors, and key
    attributes are captured in the observability backend.

    Parameters
    ----------
    file_path : str
        The fully-qualified path to the file on disk that should be processed.
    filename : str
        The human-readable name of the file (used for logging, metadata payloads,
        and deriving the file extension for parser selection).
    source_type : str
        A category label attached to every indexed chunk (e.g. "true", "noisy",
        "general"), enabling downstream filtering at retrieval time.

    Returns
    -------
    str
        "indexed" when the file's chunks were written to Qdrant, "skipped" when the file
        type is unsupported or no text/chunks were produced, and "failed" when an error
        occurred (it is logged, and the caller decides how to report it so one bad file
        does not stop the batch but is never silently lost).
    """
    with logfire.span("Processing File", file=filename, source=source_type):
        try:
            # 1. Extract text based on file extension
            ext = filename.lower().rsplit(".", 1)[-1]
            if ext == "pdf":
                full_text = parse_pdf(file_path)
            elif ext in ("html", "htm"):
                full_text = parse_html(file_path)
            elif ext == "txt":
                full_text = parse_text(file_path)
            elif ext in ("docx", "pptx"):
                full_text = parse_office(file_path)
            else:
                logfire.warning(f"Skipping unsupported file type: {filename}")
                return "skipped"

            if not full_text or not full_text.strip():
                logfire.warning(f"No text extracted from {filename} — skipping.")
                return "skipped"

            # 2. Chunk text
            chunks = chunk_text(full_text)
            if not chunks:
                return "skipped"

            # 3. Save processed metadata locally
            processed_data = {
                "filename": filename,
                "source_type": source_type,
                "chunks": chunks,
            }
            local_path = save_processed_locally(processed_data, source_type, filename)
            logfire.info(f"Saved processed data → {local_path}")

            # 4. Embed and index in Qdrant
            with logfire.span("Vectorizing & Indexing"):
                embeddings = embed_texts(chunks)
                # Deterministic IDs: identical (source, chunk) pairs collapse into one point.
                points = {}
                for chunk, vector in zip(chunks, embeddings):
                    pid = point_id(filename, chunk)
                    points[pid] = models.PointStruct(
                        id=pid,
                        vector=vector,
                        payload={
                            "text": chunk,
                            "source": filename,
                            "source_type": source_type,
                        },
                    )
                batch = list(points.values())

                for i in range(0, len(batch), UPSERT_BATCH_SIZE):
                    qdrant_client.upsert(
                        collection_name=settings.QDRANT_COLLECTION_NAME,
                        points=batch[i : i + UPSERT_BATCH_SIZE],
                    )
                logfire.info(f"Indexed {len(batch)} points to Qdrant from {filename}.")

            return "indexed"

        except Exception as e:
            logfire.error(f"Failed to process {filename}: {e}")
            return "failed"


def process_directory(dir_path: str, source_type: str) -> dict:
    """
    Ingest every file under `dir_path` (recursively, skipping hidden files and folders)
    by delegating each one to `process_file`.

    Each file is processed independently so a failure in one document does not stop
    the others, but failures are collected and returned so the caller can report them.

    Returns
    -------
    dict
        {"indexed": int, "skipped": int, "failed": [relative paths of failed files]}
    """
    report = {"indexed": 0, "skipped": 0, "failed": []}
    with logfire.span("Scanning Directory", path=dir_path, source=source_type):
        found = []
        for root, dirs, names in os.walk(dir_path):
            dirs[:] = sorted(d for d in dirs if not d.startswith("."))
            for name in sorted(names):
                if not name.startswith("."):
                    found.append(os.path.join(root, name))
        logfire.info(f"Found {len(found)} files in {dir_path}.")

        for path in found:
            result = process_file(path, os.path.basename(path), source_type)
            if result == "indexed":
                report["indexed"] += 1
            elif result == "failed":
                report["failed"].append(os.path.relpath(path, dir_path))
            else:
                report["skipped"] += 1
    return report


def run_universal_ingestion(base_dir: str, explicit_source_type: str = None, wipe: bool = False):
    """
    Entry-point orchestrator that drives the end-to-end ingestion of an entire data
    directory tree into Qdrant, with optional collection wipe-and-recreate support.

    This function handles three top-level responsibilities:

      1. **Collection lifecycle management** — If `wipe=True`, the existing Qdrant
         collection is deleted before any documents are processed, providing a clean
         slate. Regardless of the wipe flag, the collection is created (with the
         correct embedding dimensionality probed at runtime) if it does not already
         exist, ensuring the pipeline is idempotent on first run.

      2. **Directory routing** — The function inspects `base_dir` for sub-directories.
         If sub-directories are present, each one is treated as a separate source-type
         bucket and processed independently. If no sub-directories are found, the
         entire directory is treated as a single source and labelled using either the
         `explicit_source_type` argument or a heuristic derived from the folder name
         ("true" / "noisy" / "general").

      3. **Source-type labelling** — Sub-directory names (and the base directory name
         in the flat case) are mapped to canonical source type strings using simple
         keyword matching: names containing "true" map to "true", names containing
         "noisy" map to "noisy", and anything else maps either to the sub-directory
         name itself or to "general".

    Parameters
    ----------
    base_dir : str
        Root directory to scan. May contain files directly or be organised into
        sub-directories, each representing a distinct document source category.
    explicit_source_type : str, optional
        When provided and `base_dir` contains no sub-directories, this value overrides
        the heuristic source-type detection and is used as the source label for all
        documents found in `base_dir`. Defaults to None.
    wipe : bool, optional
        When True, the Qdrant collection is deleted and recreated before ingestion
        begins, removing all previously indexed vectors. Defaults to False.

    Returns
    -------
    None
        All output is produced as side-effects. Completion status and key metrics are
        recorded through logfire spans and log statements throughout execution.
    """
    with logfire.span("Universal Ingestion Started", base_directory=base_dir):

        # Wipe collection if requested
        if wipe:
            with logfire.span("Wiping Collection"):
                if qdrant_client.collection_exists(settings.QDRANT_COLLECTION_NAME):
                    qdrant_client.delete_collection(settings.QDRANT_COLLECTION_NAME)
                    logfire.info(f"Collection '{settings.QDRANT_COLLECTION_NAME}' deleted.")

        # Recreate collection — dimension resolved at runtime after embedding model probe
        dim = get_embedding_dim()
        if not qdrant_client.collection_exists(settings.QDRANT_COLLECTION_NAME):
            qdrant_client.create_collection(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=dim,
                    distance=models.Distance.COSINE,
                ),
            )
            logfire.info(
                f"Created collection '{settings.QDRANT_COLLECTION_NAME}' "
                f"({dim}-dim, Cosine)."
            )
        else:
            # An existing collection must match the embedding model's vector size.
            existing = qdrant_client.get_collection(settings.QDRANT_COLLECTION_NAME).config.params.vectors.size
            if existing != dim:
                raise RuntimeError(
                    f"Collection '{settings.QDRANT_COLLECTION_NAME}' has {existing}-dim vectors but the "
                    f"embedding model produces {dim}-dim. Re-run with --wipe to rebuild it."
                )

        total = {"indexed": 0, "skipped": 0, "failed": []}

        def merge(report: dict, label: str = ""):
            total["indexed"] += report["indexed"]
            total["skipped"] += report["skipped"]
            total["failed"] += [os.path.join(label, f) for f in report["failed"]]

        entries = sorted(e for e in os.listdir(base_dir) if not e.startswith("."))
        subdirs = [d for d in entries if os.path.isdir(os.path.join(base_dir, d))]
        loose_files = [f for f in entries if os.path.isfile(os.path.join(base_dir, f))]

        if explicit_source_type:
            # An explicit label applies to every file under base_dir, however it is nested.
            logfire.info(f"Processing '{base_dir}' as '{explicit_source_type}'.")
            merge(process_directory(base_dir, explicit_source_type))
        else:
            base_name = os.path.basename(os.path.normpath(base_dir))
            if loose_files:
                # Files sitting directly in base_dir (not in a sub-folder) must not be dropped.
                source_type = source_type_from_name(base_name, "general")
                logfire.info(f"Processing {len(loose_files)} top-level files as '{source_type}'.")
                for name in loose_files:
                    result = process_file(os.path.join(base_dir, name), name, source_type)
                    if result == "indexed":
                        total["indexed"] += 1
                    elif result == "failed":
                        total["failed"].append(name)
                    else:
                        total["skipped"] += 1
            for subdir in subdirs:
                source_type = source_type_from_name(subdir, subdir)
                merge(process_directory(os.path.join(base_dir, subdir), source_type), subdir)

        logfire.info(
            f"Ingestion summary: {total['indexed']} files indexed, {total['skipped']} skipped, "
            f"{len(total['failed'])} failed."
        )
        return total


if __name__ == "__main__":
    # Usage:
    #   python -m app.ingestion.processors DATA --wipe
    #   python -m app.ingestion.processors DATA/true_data true
    wipe_requested = "--wipe" in sys.argv
    clean_args = [a for a in sys.argv if a != "--wipe"]

    target_dir = clean_args[1] if len(clean_args) > 1 else "DATA"
    explicit_type = clean_args[2] if len(clean_args) > 2 else None

    if not os.path.exists(target_dir):
        print(f"Error: path '{target_dir}' does not exist.")
        sys.exit(1)

    summary = run_universal_ingestion(target_dir, explicit_source_type=explicit_type, wipe=wipe_requested)
    print(
        f"Ingestion finished: {summary['indexed']} indexed, {summary['skipped']} skipped, "
        f"{len(summary['failed'])} failed."
    )
    if summary["failed"]:
        print("Failed files:")
        for name in summary["failed"]:
            print(f"  - {name}")
        sys.exit(1)
    logfire.info("Ingestion job completed.")
