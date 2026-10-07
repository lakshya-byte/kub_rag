# ============================================================
# CRITICAL: logfire MUST be configured before ALL other imports
# so that spans from all modules are captured from the start.
# ============================================================
import logfire
import os
from dotenv import load_dotenv

load_dotenv()
logfire.configure(
    service_name="enterprise-rag-api",
    token=os.getenv("LOGFIRE_TOKEN"),
    send_to_logfire="if-token-present",  # never crash just because Logfire isn't set up
)

# Now safe to import app modules - logfire is already active
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from app.config import settings
from app.agents.graph import rag_agent
from app.agents.state import REPLACE_KEY
from app.guardrails import initialize_rails, guard


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_rails()
    yield


# Initialize FastAPI
app = FastAPI(title="Enterprise Agentic RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    q: str = Field(min_length=1, max_length=4000)
    # A missing thread_id starts a fresh conversation; null / empty is rejected (422).
    thread_id: str = Field(default_factory=lambda: uuid.uuid4().hex, min_length=1, max_length=128)
    # Number of messages the client currently shows for this conversation. When the saved
    # history is longer (a request was stopped / regenerated / edited), the server rewinds to match.
    keep_messages: Optional[int] = Field(default=None, ge=0)


def _saved_messages(config: dict) -> list:
    snapshot = rag_agent.get_state(config)
    return list((snapshot.values or {}).get("messages", []))


def _rewind_thread(config: dict, keep: Optional[int]) -> None:
    """Trim the thread's saved history to `keep` messages so memory matches the UI."""
    if keep is None:
        return
    msgs = _saved_messages(config)
    if keep < len(msgs):
        rag_agent.update_state(config, {"messages": [{REPLACE_KEY: msgs[:keep]}]}, as_node="responder")


@app.get("/")
def home():
    return {"message": "Enterprise LangGraph RAG API is live."}


_graph_png: Optional[bytes] = None


@app.get("/graph")
def get_graph_image():
    """
    Returns the Mermaid image of the agent's workflow.
    """
    global _graph_png
    if _graph_png is None:
        try:
            _graph_png = rag_agent.get_graph().draw_mermaid_png()
        except Exception as e:
            logfire.error(f"Could not generate graph image: {e}")
            raise HTTPException(status_code=502, detail=f"Could not generate graph image: {e}")
    return Response(content=_graph_png, media_type="image/png")


@app.post("/query")
def query(request: QueryRequest):
    """
    Executes the LangGraph RAG flow with memory using a POST request.
    """
    q = request.q
    thread_id = request.thread_id

    initial_state = {
        "messages": [{"role": "user", "content": q}],
        "current_query": q,
        "documents": [],
        "source_meta": [],
        "plan": ["Start"],
        "status": "Initializing Graph..."
    }
    
    # Configuration for Memory (Thread ID)
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        _rewind_thread(config, request.keep_messages)

        # Gate 1: guardrail classifier — blocks off-topic, jailbreaks, harmful asks; answers greetings
        rail_fired, rail_response = guard(q)
        if rail_fired:
            logfire.info(f"🛡️ Request blocked by guardrails | thread={thread_id}")
            # Keep the exchange in conversation memory so follow-ups ("what did I say first?") work
            rag_agent.update_state(
                config,
                {"messages": [
                    {"role": "user", "content": q},
                    {"role": "assistant", "content": rail_response},
                ]},
                as_node="responder",
            )
            return {
                "question": q,
                "thread_id": thread_id,
                "answer": rail_response,
                "thought_process": ["Intent: Guardrails Fired", "Retrieval: Skipped"],
                "status": "Blocked by guardrails.",
                "sources": [],
                "source_meta": []
            }

        # Gate 2: LangGraph RAG pipeline
        # Run the graph synchronously to preserve Logfire context variables
        final_output = rag_agent.invoke(initial_state, config=config)
        
        return {
            "question": q,
            "thread_id": thread_id,
            "answer": final_output.get("final_answer"),
            "thought_process": final_output.get("plan"),
            "status": final_output.get("status"),
            "sources": final_output.get("documents", []),
            "source_meta": final_output.get("source_meta", [])
        }
    except Exception as e:
        logfire.error(f"❌ Backend Execution Failed: {e}")
        return {
            "question": q,
            "thread_id": thread_id,
            "answer": "I apologize, but I encountered an internal error while processing your request. Please try again later.",
            "thought_process": ["Error encountered during execution."],
            "status": "error",
            "sources": [],
            "source_meta": []
        }
