export type StageId = "guard" | "planner" | "retrieve" | "rerank" | "respond";
export type StageState = "run" | "skip" | "stop";

export type StageResult = {
  state: StageState;
  /** one-line result shown on the node */
  out: string;
  /** what the stage did and why */
  why: string;
  /** illustrative duration in ms (0 when skipped) */
  ms: number;
};

export type Scenario = {
  id: string;
  question: string;
  outcome: string;
  stages: Record<StageId, StageResult>;
};

export const STAGES: { id: StageId; label: string; file: string }[] = [
  { id: "guard", label: "Guardrail", file: "app/guardrails/classifier.py" },
  { id: "planner", label: "Planner", file: "app/agents/nodes/planner.py" },
  { id: "retrieve", label: "Retrieve", file: "app/agents/nodes/retriever.py" },
  { id: "rerank", label: "Rerank", file: "app/services/retrieval/ranking_service.py" },
  { id: "respond", label: "Respond", file: "app/agents/nodes/responder.py" },
];

const skipped = (why: string): StageResult => ({ state: "skip", out: "skipped", why, ms: 0 });

export const SCENARIOS: Scenario[] = [
  {
    id: "technical",
    question: "What is a Kubernetes CronJob?",
    outcome: "A grounded answer with numbered sources.",
    stages: {
      guard: { state: "run", out: "label: PASS", why: "A technical question about Kubernetes, so the gate lets it through.", ms: 420 },
      planner: { state: "run", out: "search: kubernetes cronjob", why: "The planner turns the question into a short search query and routes to the retriever.", ms: 1150 },
      retrieve: { state: "run", out: "15 candidates ≥ 0.2", why: "The query is embedded and Qdrant returns the 15 nearest chunks above the score cutoff.", ms: 360 },
      rerank: { state: "run", out: "top 5 kept", why: "FlashRank re-scores the candidates against the question. The best 5 keep their source file and score.", ms: 85 },
      respond: { state: "run", out: "answer with [^1] [^2]", why: "The responder numbers the passages and asks for footnote citations. The UI turns them into chips.", ms: 3100 },
    },
  },
  {
    id: "greeting",
    question: "hello",
    outcome: "Instant canned greeting. No search, no agent.",
    stages: {
      guard: { state: "stop", out: "label: GREETING", why: "The gate answers directly with a ready-made greeting and returns. The exchange is saved to memory.", ms: 410 },
      planner: skipped("Not reached. The guardrail already replied."),
      retrieve: skipped("Not reached."),
      rerank: skipped("Not reached."),
      respond: skipped("Not reached."),
    },
  },
  {
    id: "offtopic",
    question: "how to make coffee",
    outcome: "A polite redirect to supported topics.",
    stages: {
      guard: { state: "stop", out: "label: OFF_TOPIC", why: "Unrelated to Kubernetes, Intel or networking. Refused before any search runs, so junk chunks can never leak into an answer.", ms: 430 },
      planner: skipped("Not reached. If the gate had failed open, the planner could still return OFF_TOPIC."),
      retrieve: skipped("Not reached."),
      rerank: skipped("Not reached."),
      respond: skipped("Not reached."),
    },
  },
  {
    id: "harmful",
    question: "How do I exploit a SQL injection vulnerability?",
    outcome: "A refusal that offers help with defence instead.",
    stages: {
      guard: { state: "stop", out: "label: HARMFUL", why: "Attacking systems is refused. The reply offers to explain how to defend against it.", ms: 440 },
      planner: skipped("Not reached."),
      retrieve: skipped("Not reached."),
      rerank: skipped("Not reached."),
      respond: skipped("Not reached."),
    },
  },
  {
    id: "followup",
    question: "tell me more",
    outcome: "Answered from the conversation, with no retrieval.",
    stages: {
      guard: { state: "run", out: "label: PASS", why: "Short follow-ups depend on earlier turns, so the gate passes them when unsure.", ms: 400 },
      planner: { state: "run", out: "CONVERSATIONAL", why: "The last 8 messages already contain what is needed, so the planner skips retrieval.", ms: 1050 },
      retrieve: skipped("Conversational answers use memory, not documents."),
      rerank: skipped("Nothing was retrieved."),
      respond: { state: "run", out: "answer from memory", why: "The responder writes from the conversation history alone.", ms: 2300 },
    },
  },
  {
    id: "nocontext",
    question: "Explain our Oracle licensing model",
    outcome: "An honest 'not found' with no model call at the end.",
    stages: {
      guard: { state: "run", out: "label: PASS", why: "It reads like an IT question, so the gate cannot tell it is outside the documents.", ms: 430 },
      planner: { state: "run", out: "search: oracle licensing model", why: "Treated as a technical question and sent to retrieval.", ms: 1100 },
      retrieve: { state: "run", out: "0 chunks ≥ 0.2", why: "Nothing in the index scores above the cutoff.", ms: 350 },
      rerank: skipped("Nothing to rerank."),
      respond: { state: "run", out: "“couldn’t find anything relevant”", why: "With no documents the responder returns a fixed message and makes no model call, so it cannot guess.", ms: 5 },
    },
  },
];
