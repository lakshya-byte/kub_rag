/** Reference data: environment variables, troubleshooting entries, glossary. Names only, never values. */

export type EnvVar = {
  name: string;
  required: "yes" | "no" | "evals";
  what: string;
  where: string;
};

export const ENV_VARS: EnvVar[] = [
  { name: "GROQ_API_KEY", required: "yes", what: "Key the guardrail classifier uses to call Groq directly.", where: "Groq console, API keys" },
  { name: "GROQ_MODEL", required: "no", what: "Model name for direct Groq use. Declared in config.", where: "Groq console, models list" },
  { name: "GUARDRAILS_MODEL", required: "no", what: "Model that classifies each message. Defaults to openai/gpt-oss-safeguard-20b. Must be enabled for your Groq key.", where: "Groq models list" },
  { name: "PORTKEY_API_KEY", required: "yes", what: "Authenticates the app to the Portkey gateway that fronts the chat model.", where: "Portkey dashboard, API keys" },
  { name: "GROQ_SLUG", required: "yes", what: "Slug of your primary Groq provider in Portkey. Used to build @slug/model names.", where: "Portkey, Model Catalog" },
  { name: "GROQ_SLUG_2", required: "yes", what: "Slug of the fallback Groq provider. May equal GROQ_SLUG.", where: "Portkey, Model Catalog" },
  { name: "PORTKEY_CONFIG", required: "no", what: "ID of a config saved in Portkey (pc-…). Needed when your workspace rejects inline configs.", where: "Portkey, Configs" },
  { name: "OPENAI_API_KEY", required: "yes", what: "Creates the embeddings used for ingestion and for every search.", where: "OpenAI platform, API keys" },
  { name: "OPENAI_EMBEDDING_MODEL", required: "no", what: "Embedding model. Defaults to text-embedding-3-small (1536 dimensions).", where: "OpenAI docs" },
  { name: "QDRANT_CLUSTER_ENDPOINT", required: "yes", what: "URL of your Qdrant cluster.", where: "Qdrant Cloud, cluster page" },
  { name: "QDRANT_API_KEY", required: "yes", what: "Key for the cluster.", where: "Qdrant Cloud, API keys" },
  { name: "QDRANT_COLLECTION_NAME", required: "yes", what: "Collection that holds the document chunks.", where: "You choose it" },
  { name: "RETRIEVAL_MIN_SCORE", required: "no", what: "Lowest similarity a chunk may have to count as relevant. Default 0.2.", where: "Tune with real queries" },
  { name: "CORS_ORIGINS", required: "no", what: "Comma-separated browser origins allowed to call the API. Defaults to localhost:3000.", where: "You choose it" },
  { name: "CHAT_DB_PATH", required: "no", what: "SQLite file that stores conversation memory. Default chat_memory.db.", where: "You choose it" },
  { name: "LOGFIRE_TOKEN", required: "no", what: "Sends traces to Logfire. Without it the app runs and traces stay local.", where: "Logfire project settings" },
  { name: "LANGSMITH_TRACING", required: "no", what: "Set to false to turn LangSmith tracing off.", where: "LangSmith settings" },
  { name: "LANGSMITH_API_KEY", required: "no", what: "Key for LangSmith tracing. An invalid key causes 403 log noise only.", where: "LangSmith settings" },
  { name: "JUDGE_GROQ", required: "evals", what: "Separate Groq key used only by the eval judge, so evals never drain the production key.", where: "Groq console, a second key" },
  { name: "EVAL_API_URL", required: "evals", what: "Query endpoint the evals call. Default http://localhost:8000/query.", where: "You choose it" },
];

export type Trouble = { id: string; symptom: string; message: string; cause: string; fix: string };

export const TROUBLES: Trouble[] = [
  {
    id: "t-startup-env",
    symptom: "API refuses to start",
    message: "Missing environment variables: GROQ_SLUG, GROQ_SLUG_2",
    cause: "The gateway needs both provider slugs to build model names. Without them every call would fail later with a confusing @None/... model.",
    fix: "Add GROQ_SLUG and GROQ_SLUG_2 to .env (the same slug twice is fine) and restart.",
  },
  {
    id: "t-portkey-inline",
    symptom: "Every question returns the generic error answer",
    message: "Error code: 400 … Reference a saved config by its 'pc-...' slug instead.",
    cause: "Your Portkey workspace rejects configs sent inline with the request.",
    fix: "Create a config in Portkey > Configs with your real slugs, copy its pc-… ID into PORTKEY_CONFIG, restart.",
  },
  {
    id: "t-portkey-keys",
    symptom: "Portkey rejects the saved config",
    message: "Following keys are not valid: YOUR_GROQ_SLUG, YOUR_GROQ_SLUG_2",
    cause: "The placeholder slugs from an example were pasted into the saved config unchanged.",
    fix: "Edit the config and replace them with the real slugs shown in Portkey's Model Catalog.",
  },
  {
    id: "t-model-404",
    symptom: "Guardrail or chat call fails",
    message: "The model `…` does not exist or you do not have access to it (model_not_found)",
    cause: "The model is retired or your key has no access to it.",
    fix: "List models for your key (GET https://api.groq.com/openai/v1/models) and set GUARDRAILS_MODEL, or the Portkey config targets, to one that is listed.",
  },
  {
    id: "t-parse-failed",
    symptom: "Guardrail call fails with a 400",
    message: "output_parse_failed … failed_generation: ''",
    cause: "A reasoning model spent its whole output budget thinking and returned nothing.",
    fix: "The classifier already sets low reasoning effort and a roomy token limit. Keep that when you swap models, and drop reasoning_effort for models that do not support it.",
  },
  {
    id: "t-openai-401",
    symptom: "Ingestion or search fails",
    message: "Error code: 401 … expired_secret_key",
    cause: "The OpenAI key is expired or revoked. Both ingestion and every search need it for embeddings.",
    fix: "Create a new key, update OPENAI_API_KEY, restart the API.",
  },
  {
    id: "t-langsmith-403",
    symptom: "Log noise on every request",
    message: "Failed to POST https://api.smith.langchain.com/runs/multipart … 403 Forbidden",
    cause: "Tracing is on with an invalid LangSmith key. Answers are not affected.",
    fix: "Set LANGSMITH_TRACING=false, or provide a valid LANGSMITH_API_KEY.",
  },
  {
    id: "t-dup-chunks",
    symptom: "Sources repeat or show one-line fragments",
    message: "Source cards with identical text, or text like 'Step 2.'",
    cause: "Data indexed before deterministic IDs and the percentile chunker still sits in the collection.",
    fix: "Re-ingest with python -m app.ingestion.processors DATA --wipe once the OpenAI key works.",
  },
  {
    id: "t-offtopic-answer",
    symptom: "An off-topic question gets a technical-looking answer",
    message: "(no error)",
    cause: "Weak retrieval cutoff plus tiny fragments let unrelated chunks through, and nothing refused the question first.",
    fix: "The guardrail classifier and the planner's OFF_TOPIC outcome now refuse before retrieval. Re-ingest to clean the data, then tune RETRIEVAL_MIN_SCORE.",
  },
  {
    id: "t-docker-api-url",
    symptom: "In Docker, the chat cannot reach the API",
    message: "TypeError: Failed to fetch (requests go to the wrong host)",
    cause: "NEXT_PUBLIC_API_URL is baked into the frontend bundle at build time, and the browser, not the container, calls it.",
    fix: "Set NEXT_PUBLIC_API_URL to a URL your browser can reach, then rebuild with `docker compose build web`. Also add the page's origin to CORS_ORIGINS.",
  },
  {
    id: "t-judge-key",
    symptom: "Evals stop before scoring anything",
    message: "JUDGE_GROQ is not set. Evals must use a separate Groq key",
    cause: "The judge deliberately never falls back to the production key, so eval runs cannot exhaust it.",
    fix: "Add JUDGE_GROQ to .env. For a one-off try, `python -m evals.demo --use-main-key` reuses GROQ_API_KEY.",
  },
  {
    id: "t-dim-mismatch",
    symptom: "Ingestion stops before writing anything",
    message: "re-run with --wipe (vector size mismatch)",
    cause: "The existing collection was built with a different embedding model, so its vector size differs.",
    fix: "Use the same OPENAI_EMBEDDING_MODEL as before, or re-ingest with --wipe.",
  },
  {
    id: "t-cors",
    symptom: "Browser shows a CORS error",
    message: "blocked by CORS policy",
    cause: "The page's origin is not in CORS_ORIGINS.",
    fix: "Add the origin (for example http://localhost:3001) to CORS_ORIGINS and restart the API.",
  },
  {
    id: "t-422",
    symptom: "POST /query returns 422",
    message: "Unprocessable Entity",
    cause: "q is empty or longer than 4000 characters, or thread_id is null or empty.",
    fix: "Send a non-empty q. Omit thread_id to start a new conversation, or send a non-empty string.",
  },
];

export type Term = { term: string; def: string };

export const GLOSSARY: Term[] = [
  { term: "Agent", def: "A program that decides which steps to run, here planner, retriever and responder, instead of following one fixed path." },
  { term: "Checkpointer", def: "LangGraph's saver of conversation state per thread. Here it is SQLite, so memory survives a restart." },
  { term: "Chunk", def: "A passage of a document, a few hundred characters, stored and searched as one unit." },
  { term: "Citation", def: "A [^n] marker in an answer pointing to the numbered source passage it relied on." },
  { term: "Cosine distance", def: "1 minus cosine similarity. Small means two texts mean similar things. The chunker splits where it jumps." },
  { term: "Embedding", def: "A list of numbers (1536 here) that represents the meaning of a text so that similar meanings sit close together." },
  { term: "Fail open", def: "When a safety check itself breaks, let the request through. The guardrail classifier does this and logs the error." },
  { term: "FlashRank", def: "A small local reranker that re-scores retrieved chunks against the question." },
  { term: "Gateway", def: "A proxy (Portkey) between the app and the model provider that adds fallback, retry and caching." },
  { term: "Golden dataset", def: "Hand-written questions with reference answers and expected tools, used to score the system." },
  { term: "Guardrail", def: "A check that refuses or redirects a message before the main pipeline runs." },
  { term: "Idempotent", def: "Running it twice gives the same result. Ingestion is idempotent because chunk IDs are derived from content." },
  { term: "LangGraph", def: "A library for building the agent as a graph of nodes that share a typed state." },
  { term: "LLM judge", def: "A model that scores another model's answers. RAGAS uses one for most metrics." },
  { term: "Point", def: "Qdrant's word for one stored record: an ID, a vector and a payload." },
  { term: "Qdrant", def: "The vector database holding every chunk's embedding and text." },
  { term: "RAG", def: "Retrieval-augmented generation: look up relevant passages first, then have the model answer from them." },
  { term: "Reducer", def: "A function that merges a node's update into the state. The messages reducer appends, or replaces on a sentinel." },
  { term: "Reranking", def: "A second, more careful scoring of the top search hits to put the best ones first." },
  { term: "Score threshold", def: "Search hits below this similarity are dropped before reranking. Here RETRIEVAL_MIN_SCORE." },
  { term: "Slug", def: "The short name of a provider saved in Portkey, used inside @slug/model names." },
  { term: "Thread", def: "One conversation, identified by thread_id. Memory is stored per thread." },
  { term: "Upsert", def: "Insert, or overwrite if the ID already exists." },
  { term: "uuid5", def: "An ID computed from a name. The same input always gives the same ID." },
];
