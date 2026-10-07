import sqlite3

import logfire
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from app.config import settings
from app.agents.state import AgentState
from app.agents.nodes.planner import planner_node
from app.agents.nodes.retriever import retrieve_node
from app.agents.nodes.responder import generate_node


# 1. Initialize the State Graph
workflow = StateGraph(AgentState)


# 2. Define the Nodes
workflow.add_node("planner", planner_node)
workflow.add_node("retriever", retrieve_node)
workflow.add_node("responder", generate_node)

# 3. Define the Edges & Routing Logic
def route_planner(state: AgentState):
    """
    Routes the workflow based on the planner's decision.
    """
    if state["current_query"] in ("CONVERSATIONAL", "OFF_TOPIC"):
        return "responder"
    return "retriever"

workflow.set_entry_point("planner")


# Conditional Edge: Planner -> Router -> (Retriever OR Responder)
workflow.add_conditional_edges(
    "planner",
    route_planner,
    {
        "retriever": "retriever",
        "responder": "responder"
    }
)


workflow.add_edge("retriever", "responder")
workflow.add_edge("responder", END)


def _build_checkpointer():
    """
    Conversation memory keyed by thread_id.
    SQLite keeps it across restarts; MemorySaver is only the fallback if the
    langgraph-checkpoint-sqlite package is missing.
    """
    try:
        from langgraph.checkpoint.sqlite import SqliteSaver

        conn = sqlite3.connect(settings.CHAT_DB_PATH, check_same_thread=False)
        return SqliteSaver(conn)
    except ImportError:
        logfire.warning(
            "langgraph-checkpoint-sqlite is not installed: using in-memory conversation "
            "memory, which is lost on restart."
        )
        return MemorySaver()


checkpointer = _build_checkpointer()


# 4. Compile the Graph with Memory
rag_agent = workflow.compile(checkpointer=checkpointer)
