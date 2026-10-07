import type { Section } from "./types";

/**
 * Inline markup used in text: `code` and **bold**. Everything here is checked against the code in app/ and evals/.
 */
export const SECTIONS: Section[] = [
  {
    id: "overview",
    title: "What this project does",
    level: "basic",
    summary: "A chat assistant that answers from your own documents, and says so when it can't.",
    learn: ["What RAG means in plain words", "The five stages every question passes through", "Why each stage exists"],
    blocks: [
      {
        t: "p",
        text: "You ask a question. The assistant does not answer from memory alone. It first **looks up** the most relevant passages in your documents, then writes an answer from them and shows which passages it used. That pattern is called retrieval-augmented generation, or RAG.",
      },
      {
        t: "p",
        text: "This project is a complete, working version of that idea: a document loader, a vector database, an agent that decides what to do with each message, safety checks in front of it, a chat interface, and a test suite that scores the answers.",
      },
      {
        t: "p",
        text: "Two ideas explain most design choices. First, **a model that is not given the right passages will guess**, so retrieval quality decides answer quality. Second, **a helpful assistant must also refuse well**: off-topic or harmful questions should be stopped early, before they cost a search or a model call.",
      },
      {
        t: "quiz",
        q: "A user asks about something your documents do not cover. What should the assistant do?",
        options: ["Answer from general knowledge", "Say it could not find that in the documentation", "Return the closest chunk anyway"],
        answer: 1,
        why: "The responder returns a fixed 'couldn't find anything relevant' answer when retrieval finds nothing, and its prompt forbids outside knowledge.",
      },
    ],
  },
  {
    id: "quickstart",
    title: "Run it locally",
    level: "basic",
    summary: "Four commands and a filled-in .env.",
    learn: ["What you need before starting", "Which environment variables matter", "The order: ingest, API, frontend"],
    blocks: [
      {
        t: "list",
        ordered: true,
        items: [
          "Python 3.14 and Node 20 or newer.",
          "Accounts: OpenAI (embeddings), Qdrant (vector database), Portkey with a Groq provider (chat model). Logfire is optional.",
          "A document folder, for example `DATA/`. Supported types: PDF, DOCX, PPTX, HTML, TXT.",
        ],
      },
      { t: "h", text: "Set up the backend" },
      {
        t: "code",
        lang: "bash",
        file: "terminal",
        code: `python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # then fill in the values`,
      },
      { t: "env" },
      { t: "h", text: "Load your documents" },
      {
        t: "code",
        lang: "bash",
        file: "terminal",
        code: `# first run, or after changing the embedding model: wipe and rebuild
python -m app.ingestion.processors DATA --wipe

# add more files later without wiping (same files overwrite themselves)
python -m app.ingestion.processors DATA`,
      },
      { t: "h", text: "Start everything" },
      {
        t: "code",
        lang: "bash",
        file: "terminal",
        code: `# terminal 1: API on http://localhost:8000
uvicorn app.main:app --reload

# terminal 2: chat UI on http://localhost:3000
cd frontend && npm install && npm run dev`,
      },
      { t: "h", text: "Or run it with Docker" },
      {
        t: "code",
        lang: "bash",
        file: "terminal",
        code: `# API on :8000 and chat UI on :3000, secrets read from .env at runtime
docker compose up --build

# load documents (one-off job; add --wipe yourself when you mean it)
docker compose --profile tools run --rm ingest`,
      },
      {
        t: "callout",
        tone: "note",
        title: "Where Docker keeps things",
        text: "Chat memory lives in the `chat_data` volume and the reranker model in `flashrank_cache`, so both survive rebuilds. The API image installs `requirements.api.txt`, which leaves out the eval tools. `.env` is never copied into an image.",
      },
      {
        t: "callout",
        tone: "tip",
        title: "The API stops early on purpose",
        text: "If `PORTKEY_API_KEY`, `GROQ_SLUG` or `GROQ_SLUG_2` is missing, startup fails with one message that names what is missing. This is better than failing on the first question.",
      },
    ],
  },
  {
    id: "architecture",
    title: "The big picture",
    level: "basic",
    summary: "Every moving part and what it is responsible for.",
    learn: ["The parts and how they connect", "Which file owns which job", "Where each part can fail"],
    blocks: [
      {
        t: "p",
        text: "Click any box to see its role, the file that implements it, and how it tends to fail. Solid lines are the question path. The dashed line shows ingestion, which runs separately and fills the database ahead of time.",
      },
      { t: "diagram", name: "architecture" },
      {
        t: "table",
        head: ["Layer", "Technology", "Why this choice"],
        rows: [
          ["Interface", "Next.js 16, React 19, Tailwind 4", "Fast to iterate, streams nothing yet, keeps chats in the browser."],
          ["API", "FastAPI", "Typed requests, automatic validation errors, simple deployment."],
          ["Agent", "LangGraph", "Explicit nodes and routing instead of one giant prompt."],
          ["Vector store", "Qdrant", "Fast similarity search with a score threshold."],
          ["Embeddings", "OpenAI text-embedding-3-small", "1536-dimension vectors, cheap and good enough for documents."],
          ["Chat model", "Groq gpt-oss through Portkey", "Portkey adds fallback, retry and caching around the model."],
          ["Memory", "SQLite checkpointer", "Conversations survive a restart with no extra service."],
          ["Tracing", "Logfire", "One trace per request showing every stage and its timing."],
        ],
      },
    ],
  },
  {
    id: "request",
    title: "Life of a question",
    level: "intermediate",
    summary: "Step through a request and see what each stage decides.",
    learn: ["The exact order of stages", "What is skipped for greetings and refusals", "Where the time goes"],
    blocks: [
      {
        t: "p",
        text: "A request crosses three layers: the **guardrail gate** in the API, then the **LangGraph agent** with its planner, retriever and responder. Use the stepper to move one stage at a time and read what that stage returned.",
      },
      { t: "diagram", name: "lifecycle", caption: "Detailed view. Step with the arrows, or press play." },
      {
        t: "deep",
        title: "What the API does around the graph",
        blocks: [
          { t: "list", items: [
            "Validates the body: `q` 1 to 4000 characters, `thread_id` non-empty (generated if missing).",
            "If `keep_messages` is smaller than the saved history, rewinds the thread so server memory matches what the UI shows.",
            "Runs the guardrail. If it fires, the user message and the canned reply are saved to the thread and the response returns immediately.",
            "Otherwise invokes the graph with the thread's saved state, then returns the answer, plan steps, sources and source scores.",
            "Any internal error is logged and returned as a friendly message with `status: \"error\"` and HTTP 200, so the UI can show a retry button.",
          ] },
        ],
      },
      {
        t: "callout",
        tone: "note",
        title: "Why guardrail replies are saved to memory",
        text: "Otherwise a follow-up such as 'what did I ask first?' after a greeting would find an empty history. Saving the refusal keeps the conversation coherent.",
      },
    ],
  },
  {
    id: "ingestion",
    title: "Turning documents into searchable chunks",
    level: "intermediate",
    summary: "Load, split by meaning, embed, store, and never duplicate.",
    learn: ["How each file type is read", "How semantic chunking decides where to cut", "Why re-running ingestion is safe"],
    blocks: [
      {
        t: "p",
        text: "Search works on small passages, so every document is cut into **chunks**. Where you cut matters. A cut in the middle of an idea gives the retriever half an answer. A fixed window of characters cuts blindly. This project cuts where the **meaning changes**.",
      },
      {
        t: "list",
        ordered: true,
        items: [
          "**Load:** PDF (with a second reader for pages that come back blank), HTML, TXT, and DOCX or PPTX through Unstructured. Hidden files are skipped and folders are walked recursively.",
          "**Normalise:** hard line wraps from PDFs are joined, then the text is split into sentences.",
          "**Embed each sentence** and measure the cosine distance between neighbours. A big jump means a topic change.",
          "**Cut** at jumps above a percentile of this document's own distances, never before a chunk reaches the minimum size and never past the maximum.",
          "**Store** chunks in batches of 200 with an ID derived from the file name and the chunk text.",
        ],
      },
      { t: "diagram", name: "chunking", caption: "Move the percentile and watch chunk boundaries and sizes change." },
      {
        t: "code",
        lang: "python",
        file: "app/ingestion/chunking/splitter.py",
        code: `chunk_text(
    text,
    breakpoint_threshold=None,   # absolute override; None = use the percentile
    max_chunk_size=1500,
    breakpoint_percentile=85,
    min_chunk_size=300,
)`,
      },
      {
        t: "deep",
        title: "Why re-running ingestion does not create duplicates",
        blocks: [
          { t: "p", text: "Each chunk's ID is `uuid5(namespace, filename + \"\\n\" + chunk_text)`. The same file produces the same IDs, so an upsert overwrites instead of adding. Two files with the same name in different formats stay distinct because the extension is part of the file name." },
          { t: "p", text: "Before writing, ingestion also checks that an existing collection's vector size matches the current embedding model and stops with a clear message if not. At the end it prints how many files were indexed, skipped and failed, and exits with status 1 if any failed." },
        ],
      },
      {
        t: "callout",
        tone: "warn",
        title: "Known limit",
        text: "Every sentence is still embedded once while chunking, so very large documents cost one embedding call per sentence. Batching these calls is a natural next optimisation.",
      },
    ],
  },
  {
    id: "retrieval",
    title: "Finding the right passages",
    level: "intermediate",
    summary: "Search, filter by score, then rerank. Why a cutoff matters.",
    learn: ["What a similarity score means", "How the cutoff and reranker work together", "The off-topic incident, explained"],
    blocks: [
      {
        t: "p",
        text: "Retrieval is a funnel. The question is embedded and Qdrant returns the **15** nearest chunks, dropping any below `RETRIEVAL_MIN_SCORE` (0.2 by default). FlashRank, a small local cross-encoder, then re-scores those against the question and the best **5** go to the responder, each with its source file and score.",
      },
      { t: "diagram", name: "retrieval", caption: "Illustrative scores. Drag the cutoff and switch the question." },
      {
        t: "callout",
        tone: "note",
        title: "The coffee incident",
        text: "Asked how to make coffee, the system once answered with numbered steps. Search had matched the word 'steps' to one-line fragments such as 'Step 2.' from an unrelated document, they cleared the weak cutoff, and the model padded them into an answer. Three fixes now stack: the guardrail refuses the question, the planner can answer OFF_TOPIC, and the responder prompt says to use only the context.",
      },
      {
        t: "p",
        text: "If nothing passes the cutoff, the responder skips the model entirely and returns a fixed message saying nothing relevant was found. A search that fails for infrastructure reasons raises an error instead, so an outage is never mistaken for 'no results'.",
      },
    ],
  },
  {
    id: "agent",
    title: "The agent graph and memory",
    level: "advanced",
    summary: "LangGraph state, routing, and a reducer that can also forget.",
    learn: ["The three nodes and the routing rule", "How state and the messages reducer work", "How Stop and Regenerate stay in sync"],
    blocks: [
      {
        t: "p",
        text: "The agent is a small LangGraph with three nodes that share one typed state. The planner decides what kind of message this is. A conditional edge then sends technical questions to the retriever, and everything else straight to the responder.",
      },
      {
        t: "code",
        lang: "python",
        file: "app/agents/graph.py",
        code: `def route_planner(state):
    if state["current_query"] in ("CONVERSATIONAL", "OFF_TOPIC"):
        return "responder"
    return "retriever"`,
      },
      {
        t: "table",
        head: ["Planner returns", "Meaning", "Next"],
        rows: [
          ["CONVERSATIONAL", "Greeting, or answerable from the last 8 messages", "Responder, from memory"],
          ["OFF_TOPIC", "Unrelated to Kubernetes, Intel or networking", "Responder refuses, no model call"],
          ["Anything else", "A refined search query", "Retriever, then responder"],
        ],
      },
      { t: "h", text: "Memory that can be rewound" },
      {
        t: "p",
        text: "Messages normally only append. But when you press Stop, Regenerate or Edit, the browser and the server would disagree about what was said. The state's `messages` field therefore uses a custom reducer: a normal update appends, while a special replace marker swaps the whole list. The UI sends `keep_messages` with each question, and the API trims the saved thread to that length first.",
      },
      { t: "diagram", name: "memory", caption: "Try Stop and Regenerate and compare the two columns." },
      {
        t: "deep",
        title: "Where memory lives",
        blocks: [
          { t: "p", text: "A SQLite file (`CHAT_DB_PATH`, default `chat_memory.db`) holds each thread's state, so restarting the API loses nothing. If the SQLite package is missing the app falls back to in-memory storage and logs a warning. Prompts only include the last 8 messages so long chats cannot overflow the model's context." },
        ],
      },
      {
        t: "quiz",
        q: "You regenerate an answer. What stops the old answer from staying in the model's memory?",
        options: ["The model forgets on its own", "keep_messages makes the API trim the thread before running", "The browser deletes the SQLite file"],
        answer: 1,
        why: "The UI sends how many messages it currently shows. If the saved thread is longer, the API replaces it with the shorter list.",
      },
    ],
  },
  {
    id: "guardrails",
    title: "Guardrails",
    level: "intermediate",
    summary: "One classification call decides whether a message is allowed through.",
    learn: ["The seven labels", "What happens for each", "Why NeMo's intent step was replaced"],
    blocks: [
      {
        t: "p",
        text: "Before any search happens, a small safety model reads the message and returns **one label**. Only `PASS` continues to the agent. Every other label returns a ready-made reply immediately, which costs one short model call instead of a whole pipeline.",
      },
      { t: "diagram", name: "guardrails", caption: "Examples are precomputed to show the behaviour. This is not a live model call." },
      {
        t: "table",
        head: ["Label", "Catches", "Reply"],
        rows: [
          ["PASS", "Technical questions, and follow-ups like 'tell me more'", "Continues to the agent"],
          ["OFF_TOPIC", "Coffee, sports, jokes, trivia", "Polite redirect to supported topics"],
          ["JAILBREAK", "'Ignore previous instructions', role changes", "Firm, friendly refusal"],
          ["HARMFUL", "Exploits, malware, credential theft", "Refusal plus an offer to explain defence"],
          ["GREETING / FAREWELL", "Hi, bye", "Short canned reply"],
          ["CAPABILITIES", "'What can you do?'", "List of covered topics"],
        ],
      },
      {
        t: "deep",
        title: "Why the first design (NeMo Guardrails) was replaced",
        blocks: [
          { t: "p", text: "NeMo's intent step asks the model to continue a transcript, for example `User intent: ask off topic`. The chat model used here followed the system prompt instead and answered 'I'm sorry, I can't help with that', so none of the Colang flows ever matched and everything fell through to the agent." },
          { t: "p", text: "A direct request to classify the message is something these models do reliably. The classifier uses `openai/gpt-oss-safeguard-20b` with a short written policy, low reasoning effort, and the message wrapped in tags so text inside it is treated as data, not instructions." },
        ],
      },
      {
        t: "callout",
        tone: "warn",
        title: "It fails open",
        text: "If the classifier errors or returns something unreadable, the message is let through and the problem is logged. This keeps a guardrail outage from taking the assistant down, at the cost of no blocking during that outage. The planner's OFF_TOPIC outcome is the second line of defence.",
      },
    ],
  },
  {
    id: "gateway",
    title: "The model gateway",
    level: "advanced",
    summary: "Portkey adds fallback, retry and caching around the chat model.",
    learn: ["What the gateway does for each request", "Why a saved config is needed", "How a cache hit is detected"],
    blocks: [
      {
        t: "p",
        text: "Chat completions do not go straight to Groq. They go through Portkey, which applies a config: try the primary provider, retry twice on rate limits (429) or service errors (503), then fall back to a second provider. A simple cache can answer repeated questions instantly.",
      },
      { t: "diagram", name: "gateway", caption: "Trigger each situation and follow the path." },
      {
        t: "code",
        lang: "json",
        file: "Portkey > Configs",
        code: `{
  "strategy": { "mode": "fallback" },
  "cache": { "mode": "simple" },
  "retry": { "attempts": 2, "on_status_codes": [429, 503] },
  "targets": [
    { "override_params": { "model": "@<GROQ_SLUG>/openai/gpt-oss-120b" } },
    { "override_params": { "model": "@<GROQ_SLUG_2>/openai/gpt-oss-120b" } }
  ]
}`,
      },
      {
        t: "callout",
        tone: "warn",
        title: "Replace the placeholders",
        text: "Put your real slugs from Portkey's Model Catalog in place of `<GROQ_SLUG>` and `<GROQ_SLUG_2>`. Then save the config and put its `pc-…` ID in `PORTKEY_CONFIG`. Without a saved config the app sends the same settings inline, which some workspaces reject.",
      },
      {
        t: "p",
        text: "To show 'Cache: Hit' in the UI, the responder reads Portkey's response headers. The SDK strips the `x-portkey-` prefix, so the value lives under `cache-status`. A missing header counts as a miss.",
      },
    ],
  },
  {
    id: "api",
    title: "API reference",
    level: "basic",
    summary: "Three endpoints, one request shape.",
    learn: ["Every endpoint", "The request and response fields", "What the error codes mean"],
    blocks: [
      {
        t: "table",
        head: ["Method", "Path", "Purpose"],
        rows: [
          ["GET", "/", "Health check."],
          ["GET", "/graph", "PNG diagram of the agent graph. Returns 502 if it cannot be drawn."],
          ["POST", "/query", "Ask a question."],
        ],
      },
      {
        t: "code",
        lang: "bash",
        file: "request",
        code: `curl -X POST http://localhost:8000/query \\
  -H 'content-type: application/json' \\
  -d '{"q": "What is a Kubernetes CronJob?", "thread_id": "demo-1"}'`,
      },
      {
        t: "code",
        lang: "json",
        file: "response",
        code: `{
  "question": "What is a Kubernetes CronJob?",
  "thread_id": "demo-1",
  "answer": "A CronJob runs Jobs on a schedule [^1].",
  "thought_process": ["Intent: Technical", "Search Term: kubernetes cronjob", "Context Retrieved"],
  "status": "Response generated.",
  "sources": ["CONTENT: A CronJob creates Jobs on a repeating schedule…"],
  "source_meta": [{ "source": "cronjobs.docx", "score": 0.8123 }]
}`,
      },
      {
        t: "table",
        head: ["Field", "Rules"],
        rows: [
          ["q", "Required, 1 to 4000 characters."],
          ["thread_id", "Optional. Omit for a new conversation. Empty or null is rejected with 422."],
          ["keep_messages", "Optional integer. Trims saved history to this many messages before running."],
          ["sources / source_meta", "Aligned by index. `source_meta` adds the file name and score."],
        ],
      },
      {
        t: "callout",
        tone: "note",
        title: "Errors come in two flavours",
        text: "Bad input returns **422**. A failure inside the pipeline returns **200** with `status: \"error\"` and a plain-language message, so a UI can offer a retry without special handling.",
      },
    ],
  },
  {
    id: "frontend",
    title: "Inside the chat interface",
    level: "intermediate",
    summary: "How the UI keeps chats, citations and server memory in step.",
    learn: ["How conversations are stored", "How citations become chips", "How the UI stays in sync with the server"],
    blocks: [
      {
        t: "list",
        items: [
          "**Store:** a small `useSyncExternalStore` store keeps conversations in localStorage. It keeps pinned chats plus the newest 50, drops stored sources for older ones, and retries with a smaller snapshot if the browser quota is hit.",
          "**Citations:** the answer text contains `[^1]`. The Markdown renderer turns only that form into a numbered chip. Clicking a chip opens the Sources dropdown, scrolls to that card and highlights it.",
          "**Sources:** each card shows the file name from `source_meta`. The dropdown starts closed.",
          "**Sync:** every question carries `keep_messages`, the count of non-error messages on screen, so Stop, Regenerate and Edit never leave stale replies on the server.",
          "**Command palette:** press the command key and K to search chats and actions.",
        ],
      },
      {
        t: "callout",
        tone: "tip",
        title: "Pointing the UI at another API",
        text: "Set `NEXT_PUBLIC_API_URL` before `npm run dev`. The default is `http://localhost:8000`, and that origin must be allowed by `CORS_ORIGINS` on the API.",
      },
    ],
  },
  {
    id: "evals",
    title: "Measuring quality",
    level: "advanced",
    summary: "Six experiments, one judge, and a confusion matrix for the guardrails.",
    learn: ["What each metric measures", "How guardrails are scored", "How the suite avoids rate limits"],
    blocks: [
      {
        t: "p",
        text: "The `evals/` folder is a Streamlit app plus a golden dataset of **21 questions** with reference answers and expected tools, and **6 guardrail cases**. It sends each question to the running API and scores what comes back.",
      },
      { t: "h", text: "See a judge catch a hallucination" },
      {
        t: "p",
        text: "New to evals? Start here. `evals/demo.py` takes one golden question and its real source passages, then scores three answers: a faithful one, one with two invented details, and a fluent answer that ignores the passages. It needs only a Groq key, no Qdrant and no running API, and takes about a minute.",
      },
      {
        t: "code",
        lang: "bash",
        file: "terminal",
        code: `python -m evals.demo                  # uses JUDGE_GROQ
python -m evals.demo --use-main-key   # falls back to GROQ_API_KEY for a quick try`,
      },
      {
        t: "callout",
        tone: "note",
        title: "How faithfulness is judged",
        text: "The judge model splits the answer into separate claims and checks each one against the retrieved passages. **Faithfulness = supported claims / all claims.** An invented detail is an unsupported claim, so the score drops. This is how a hallucination becomes a number.",
      },
      { t: "h", text: "Run the full suite" },
      {
        t: "code",
        lang: "bash",
        file: "terminal",
        code: `# needs: API running, documents ingested (valid OpenAI key), JUDGE_GROQ set
streamlit run evals/app.py`,
      },
      {
        t: "callout",
        tone: "warn",
        title: "It spends real quota",
        text: "Each question is a live API call (with a 10 second pause between them), followed by several judge calls per metric. Expect many minutes. If answers come back as errors, fix the API first, because scoring errors tells you nothing about quality.",
      },
      { t: "diagram", name: "evals", caption: "Explore the metrics, then play with the confusion matrix." },
      {
        t: "list",
        items: [
          "A separate Groq key (`JUDGE_GROQ`) powers the judge, so evals never exhaust the production key. Without it the suite stops with a clear message.",
          "Judge calls run two at a time and retry with exponential backoff on rate limits, instead of fixed multi-second sleeps.",
          "If a request errors, the sample is recorded as an error and excluded from precision and recall. It is never counted as a correct block or a miss.",
          "Thread IDs include a per-run identifier so reruns do not inherit earlier conversations.",
        ],
      },
    ],
  },
  {
    id: "observability",
    title: "Seeing inside a request",
    level: "intermediate",
    summary: "Logfire traces show each stage and how long it took.",
    learn: ["Which spans exist", "What to look for when something is slow", "Running without any tracing"],
    blocks: [
      {
        t: "p",
        text: "Logfire is configured before any other import so every module's spans are captured. One request produces a nested trace, and the span names tell you where time went.",
      },
      {
        t: "table",
        head: ["Span", "Stage", "What a long one usually means"],
        rows: [
          ["🛡️ Guardrails Check", "Classifier call", "Safety model is slow or rate limited"],
          ["🧠 Planner Decision", "Planner LLM call", "Gateway fallback or retry kicked in"],
          ["🔍 Knowledge Retrieval", "Embed plus Qdrant search", "Embedding API or cluster latency"],
          ["⚖️ Semantic Reranking", "FlashRank", "First call loads the model"],
          ["✍️ LLM Synthesis", "Responder LLM call", "Long context or reasoning time"],
        ],
      },
      {
        t: "callout",
        tone: "note",
        title: "No token, no problem",
        text: "Without `LOGFIRE_TOKEN` the app still runs. Traces simply are not sent anywhere.",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "When something breaks",
    level: "basic",
    summary: "Real errors from this project, with causes and fixes.",
    learn: ["How to match an error to its cause", "Which problems are configuration, not code"],
    blocks: [{ t: "troubleshooting" }],
  },
  {
    id: "glossary",
    title: "Glossary",
    level: "basic",
    summary: "Every term used here, in one sentence.",
    learn: ["Plain definitions"],
    blocks: [{ t: "glossary" }],
  },
  {
    id: "limits",
    title: "Known limits and next steps",
    level: "basic",
    summary: "What to be careful about, stated honestly.",
    learn: ["Current weaknesses", "Where to invest next"],
    blocks: [
      {
        t: "list",
        items: [
          "**Old data:** until you re-ingest with `--wipe`, the collection may hold duplicate and one-line chunks from earlier runs.",
          "**Retrieval cutoff:** `RETRIEVAL_MIN_SCORE` defaults to 0.2. Tune it by trying real and off-topic questions.",
          "**Guardrail outage:** the classifier fails open, so during an outage nothing is blocked there. Planner and responder checks remain.",
          "**Chunking cost:** every sentence is embedded once during chunking.",
          "**No streaming:** answers arrive whole, and the UI types them out.",
          "**Eval scores** depend on the judge model and on a clean index, so compare runs only against the same setup.",
        ],
      },
      {
        t: "list",
        items: [
          "Stream tokens from the API to the UI.",
          "Batch sentence embeddings during chunking.",
          "Add hybrid search (keywords plus vectors) for exact terms such as error codes.",
          "Run the eval suite in CI with a small golden set.",
        ],
      },
    ],
  },
];
