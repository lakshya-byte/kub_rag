# Marathon 2: Enterprise Agentic RAG Assistant

## 1. What it is
A chat assistant that answers questions from a private document collection (Kubernetes manuals, Intel documentation, networking guides and similar) and shows where every answer came from. Each answer carries numbered citations that open a Sources panel with the passages used. If the documents do not contain the answer, it says so instead of guessing.

It is a full system, not a notebook: a web UI, an API, an agent with memory, a safety gate, a retrieval pipeline, an LLM gateway, an offline ingestion job, an evaluation suite, tracing, tests, Docker packaging and an interactive documentation site.

## 2. Tech stack and why each piece is there
| Layer | Choice | Why |
|---|---|---|
| UI | Next.js 16, React 19, Tailwind 4, framer-motion | App Router, fast static pages, smooth interaction |
| API | FastAPI + Pydantic | Typed request validation, async, auto docs |
| Agent | LangGraph | Explicit state machine with routing and a durable checkpointer, instead of an opaque agent loop |
| Memory | SQLite via the LangGraph checkpointer | Conversations survive restarts, zero extra infrastructure |
| Vector store | Qdrant (cloud) | Fast similarity search with score thresholds |
| Embeddings | OpenAI embeddings | Strong quality for semantic search |
| Reranker | FlashRank (local, ONNX) | Re-scores candidates without another network call |
| Chat model | Groq `openai/gpt-oss-120b` | Fast inference |
| Gateway | Portkey | Fallback to a second provider, retry on 429/503, optional cache |
| Guardrail model | Groq `openai/gpt-oss-safeguard-20b` | A model built for classification against a policy |
| Tracing | Logfire | A trace per request, showing each stage and its timing |
| Evals | RAGAS, Streamlit | Metrics for hallucination, retrieval and correctness |
| Packaging | Docker Compose | One command to run API and UI |

## 3. Architecture
```
Chat UI (Next.js)
   |  POST /query {q, thread_id, keep_messages}
FastAPI  --validate--> rewind memory (if keep_messages) --> guardrail classifier --> LangGraph agent
                                                                                    |
                         planner --(technical)--> retriever --> responder --> answer + sources
                            |--(conversational / off-topic)------------------^
Qdrant <-- OpenAI embeddings        Portkey -> Groq (planner + responder)        SQLite (per-thread memory)
Ingestion (offline): files -> loaders -> semantic chunks -> embeddings -> Qdrant
Logfire: spans for every stage        Evals: golden questions -> API -> RAGAS judge
```

### 3.1 The request path, step by step
1. **Validation.** `q` is 1 to 4000 characters, `thread_id` identifies the conversation, and an optional `keep_messages` says how much history to keep.
2. **Memory rewind.** If `keep_messages` is set (Stop or Regenerate in the UI), the server trims the saved thread to match what the user actually saw.
3. **Guardrail gate.** One short classifier call returns one of seven labels: PASS, OFF_TOPIC, JAILBREAK, HARMFUL, GREETING, FAREWELL, CAPABILITIES. Anything other than PASS returns a canned reply immediately with no further model calls. The user message is wrapped in `<message>` tags and treated as data, so it cannot instruct the classifier. If the classifier errors or returns something unparseable, the message passes (fail open) and the error is logged.
4. **Planner.** An LLM decides: conversational (answer from memory), off-topic, or a technical question, in which case it writes a focused search query.
5. **Retriever.** Embeds the query, asks Qdrant for up to 15 candidates above a minimum score (`RETRIEVAL_MIN_SCORE`, default 0.2), then FlashRank reranks and keeps the best 5.
6. **Responder.** Builds a numbered context block and answers using only that context, with `[n]` citations. If nothing relevant was retrieved, it returns a fixed "I could not find anything relevant" answer without calling the model at all.
7. **Response.** Answer, sources, and a `thought_process` list the UI shows as a "How I answered" trail.

### 3.2 The agent graph
State holds the message history, the current query and a plan trace. A custom `messages` reducer supports a special replace sentinel, which is how the server rewinds a thread. Routing after the planner sends CONVERSATIONAL and OFF_TOPIC straight to the responder and technical questions through the retriever.

### 3.3 Ingestion
- Loaders for PDF (pypdf with a pdfplumber fallback), HTML (BeautifulSoup), plain text and Office files (unstructured, python-docx, python-pptx).
- **Semantic chunking.** Sentences are embedded, the cosine distance between neighbours is computed, and a chunk boundary is placed where the distance exceeds a percentile of that document's own distances (default 85th), with a minimum chunk size so no fragment is a single line.
- **Stable IDs.** Each point's ID is a `uuid5` of source plus chunk text, so re-running ingestion overwrites instead of duplicating.
- Upserts go in batches of 200. The collection's vector size is checked against the embedding model before writing. Per-file failures are collected and the run exits non-zero so nothing fails silently. `--wipe` rebuilds the collection.

### 3.4 Gateway
Portkey sits in front of the chat model with a fallback strategy (two provider slugs), retry on 429 and 503, and a simple cache. The classifier deliberately bypasses Portkey and calls Groq directly.

### 3.5 Frontend
Chat store built on `useSyncExternalStore` with local persistence and quota trimming (50 unpinned chats kept, pinned chats always kept). Streaming-style typed answers, citation chips that open and scroll the Sources dropdown, edit and retry, regenerate, feedback buttons, a command palette (Cmd+K), a workflow graph dialog, light and dark themes, an animated wave background on the start screen that freezes once a chat begins, and a built-in documentation site at `/docs`.

### 3.6 Documentation site
Sixteen chapters at three depth levels with a live question tracer, a clickable architecture map, labs for chunking, retrieval, memory rewind, guardrails and gateway, a metrics explainer with a confusion matrix, searchable troubleshooting and glossary. Demo numbers are labelled illustrative and nothing on the page calls a model.

### 3.7 Evaluation
A golden dataset of 21 questions (with reference answers and expected tools) and 6 guardrail cases. Phase 1 sends questions to the live API. Phase 2 scores with RAGAS: **faithfulness** (hallucination), answer relevancy, context precision, context recall and answer correctness, plus tool correctness (set overlap, no LLM). The guardrail eval counts true and false positives and negatives and reports precision and recall. The judge uses a separate Groq key (`JUDGE_GROQ`) so evals cannot use up production quota, with 429 retry and exponential backoff.

## 4. Problems we hit and how we fixed them

### 4.1 Guardrails did not work (the coffee question)
- **Symptom:** "how to make a coffee" was answered normally.
- **Diagnosis:** the NeMo Guardrails intent step asks the model to emit a structured line (`User intent: ...`). Chat and reasoning models obey the system prompt and refuse or answer instead, so the intent never matched a rule and the rails never fired. Inspecting NeMo's recorded LLM calls proved it.
- **Fix:** replaced it with a direct classifier call that returns one JSON label, with a policy prompt, `reasoning_effort="low"` and enough `max_tokens`. Canned replies exist for every non-PASS label. The user confirmed it works.
- **Defense in depth:** the planner has its own OFF_TOPIC route and the responder is told to use only the retrieved context, so a classifier miss does not turn into a confident off-topic answer.

### 4.2 Model errors from Groq
- **404 on a Llama model:** the key only had access to gpt-oss models, and Llama chat models had been decommissioned. The guardrail model became configurable (`GUARDRAILS_MODEL`) and all Llama references were replaced with gpt-oss.
- **400 `output_parse_failed` with gpt-oss-120b:** reasoning output broke structured parsing. Setting `reasoning_effort="low"` and a larger token budget fixed it.

### 4.3 Portkey configuration
- **Inline config rejected (400):** some workspaces refuse configs sent with the request. Fix: reference a saved config by its `pc-...` id through `PORTKEY_CONFIG`.
- **"Following keys are not valid: YOUR_GROQ_SLUG":** placeholder slugs in the saved config. Real slugs are required.
- **Defensive change:** startup now fails with one message naming missing variables, instead of failing on the first user question.

### 4.4 Retrieval quality
- **Junk passing the threshold:** at the default score cutoff, off-topic questions still returned chunks. The cutoff is now configurable and explained with an interactive slider.
- **Duplicate and one-line chunks:** old ingestion produced these. Chunking was reworked (percentile boundaries, minimum size) and IDs became deterministic. Data already in Qdrant stays old until it is re-ingested with `--wipe`.
- **Infrastructure errors were mistaken for "no results":** Qdrant errors are now raised, not swallowed.

### 4.5 Conversation memory
Stopping or regenerating left the server remembering answers the user never saw. The `keep_messages` field plus a replace-capable reducer rewinds the saved thread to match the UI.

### 4.6 The 37-bug audit
An audit produced 37 open bugs. All were fixed in code, covering input validation, error handling, ingestion safety, evaluation correctness (for example, guardrail request errors are no longer counted as correct predictions, and thread IDs now carry a per-run id so reruns do not inherit old conversations) and more. An offline test suite grew from 25 to 42 tests, needing no network or real keys.

### 4.7 Frontend issues
- **Sources dropdown:** added an open and close control with a count badge; clicking a citation opens it and scrolls to the passage.
- **ESLint rules in the docs:** state set inside effects and mutation during render were refactored (scroll position computed in the handler, offsets precomputed).
- **Mobile overflow:** long error messages and file paths were wrapped, and tracer text wraps instead of truncating.

### 4.8 Docker
- **`unstructured` 0.27 does not support Python 3.14**, so the image uses Python 3.13 while local development used 3.14.
- **Image size:** a runtime-only requirements file leaves out eval tools and torch.
- **Frontend API URL:** `NEXT_PUBLIC_API_URL` is baked in at build time and read by the browser, so it is a build argument, and changing it needs a rebuild.
- **Secrets:** `.env` is never copied into an image; it is passed at runtime. Chat memory and the reranker model live in named volumes.

## 5. Reliability and safety decisions
- Fail fast on missing configuration, fail open (with logging) on the guardrail so an outage does not take the app down.
- Canned replies for blocked or off-topic messages cost no model call.
- Answers are grounded: no context means a fixed "not found" reply.
- Separate Groq key for evals. Secrets are never logged or committed.
- Provider fallback and retries through the gateway.

## 6. Current status and honest limits
- Working and verified: guardrails (confirmed by the user), grounded answers with citations, the UI, the docs site, the wave background, Docker images (built, API healthy, tests pass inside), 42 offline tests locally.
- **Evals have not produced published scores yet.** The full run needs a valid OpenAI key, a re-ingest of the documents, and `JUDGE_GROQ`.
- Old chunks in Qdrant remain until `--wipe` re-ingestion.
- Sentence-level embedding during chunking costs one embedding per sentence.
- The guardrail fails open by design.
- `nemoguardrails`, `deepeval` and `langfuse` are listed in `requirements.txt` but unused.
- Python 3.14 locally versus 3.13 in Docker.

## 7. What I would do next
Run and publish the eval scores, re-ingest with the new chunker, tune `RETRIEVAL_MIN_SCORE` from the eval results, add the eval suite as a Docker profile, remove unused dependencies, and add authentication and rate limiting in front of the API.
