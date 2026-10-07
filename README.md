# Marathon 2: Enterprise Agentic RAG

A chat assistant that answers questions from your own documents, with citations. A question passes a safety gate, a planner decides whether to search, the best passages are retrieved and reranked, and a model writes an answer that cites them.

```
Chat UI (Next.js) -> FastAPI -> guardrail classifier -> LangGraph agent
                                                         planner -> retriever -> responder
Qdrant (vectors) <- OpenAI embeddings      Portkey -> Groq gpt-oss (answers)      SQLite (memory)
```

| Part | Tech |
|---|---|
| API | FastAPI, Logfire tracing |
| Agent | LangGraph (planner, retriever, responder) with SQLite conversation memory |
| Retrieval | Qdrant (cloud), OpenAI embeddings, FlashRank reranker |
| Models | Groq `openai/gpt-oss-120b` through the Portkey gateway; guardrail uses `openai/gpt-oss-safeguard-20b` |
| Frontend | Next.js 16, React 19, Tailwind 4 |
| Evals | RAGAS judged by a separate Groq key, Streamlit dashboard |

The interactive documentation lives in the app at **`/docs`** (architecture map, request tracer, chunking and retrieval labs, troubleshooting). Read it first if you are new.

## Quickstart

### 1. Configure
```bash
cp .env.example .env     # then fill in the values; .env is git-ignored, never commit it
```
Required to start: `GROQ_API_KEY`, `PORTKEY_API_KEY`, `GROQ_SLUG`, `GROQ_SLUG_2`, `OPENAI_API_KEY`, `QDRANT_API_KEY`, `QDRANT_CLUSTER_ENDPOINT`, `QDRANT_COLLECTION_NAME`. The API stops at startup with one message naming anything missing. If your Portkey workspace rejects inline configs, create a saved config and set `PORTKEY_CONFIG=pc-...`. See `.env.example` for every variable.

### 2. Run with Docker
```bash
docker compose up --build          # API on :8000, chat UI on :3000
```
Chat memory and the reranker model live in named volumes, so they survive rebuilds. `NEXT_PUBLIC_API_URL` is baked into the frontend at build time; after changing it run `docker compose build web`.

### 2b. Or run locally
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload                 # terminal 1: http://localhost:8000
cd frontend && npm install && npm run dev     # terminal 2: http://localhost:3000
```

### 3. Load your documents
Put files (PDF, HTML, text, Office) in `DATA/`, then:
```bash
python -m app.ingestion.processors DATA                 # add --wipe to rebuild the collection
docker compose --profile tools run --rm ingest          # same thing in Docker
```
`--wipe` deletes the existing collection first. Use it after changing the embedding model, or to clear old duplicate chunks. Ingestion needs a valid `OPENAI_API_KEY`.

## Tests
```bash
python -m pytest tests          # 42 offline tests, no network or real keys needed
```

## Evals: seeing hallucination detection in action
`evals/` scores the pipeline with RAGAS: faithfulness (hallucination), answer relevancy, context precision, context recall, answer correctness, plus tool correctness and a guardrail confusion matrix, over a golden dataset of 21 questions and 6 guardrail cases.

**Quick demo (about a minute, only needs a Groq key).** Scores a faithful answer, a hallucinated one and an off-context one against real source passages, so you can watch the judge separate them:
```bash
python -m evals.demo                    # uses JUDGE_GROQ
python -m evals.demo --use-main-key     # falls back to GROQ_API_KEY if JUDGE_GROQ is not set
```
**Full run.** Needs the API running, documents ingested (valid OpenAI key) and `JUDGE_GROQ` set to a separate Groq key so evals never use up the production key:
```bash
streamlit run evals/app.py
```
Each question takes a live API call, then several judge calls, so a full run takes many minutes and uses LLM quota.

## Project layout
```
app/            FastAPI app, agent graph, guardrails, gateway client, retrieval, ingestion
frontend/       Next.js chat UI, plus the /docs documentation (docs/ content, components/docs/)
evals/          RAGAS metrics, live pipeline runner, guardrail eval, Streamlit dashboard, demo
tests/          offline tests
DATA/           your source documents
Dockerfile, docker-compose.yml, requirements.api.txt   container setup (runtime-only dependencies)
```

## Good to know
- **Guardrails fail open.** If the classifier call errors, the message is let through and the error is logged to Logfire.
- **Off-topic questions** (for example "how do I make coffee") are refused by the guardrail, the planner and the responder. The responder only answers from retrieved context.
- **Old data:** chunks ingested before the chunking fixes may be duplicated or one line long. Re-ingest with `--wipe` to clean them, then tune `RETRIEVAL_MIN_SCORE` (default 0.2).
- **Python versions:** Docker uses 3.13 because `unstructured` 0.27 does not support 3.14.
- **Secrets:** `.env` is never copied into images. Rotate any key that has been shared or logged.
- `app/guardrails/colang_rules.py` is a leftover from the old NeMo guardrails and is no longer used.

Common errors (expired OpenAI key, missing Portkey slugs, model 404, `output_parse_failed`, CORS) are listed with fixes in the **Troubleshooting** chapter of `/docs`.
