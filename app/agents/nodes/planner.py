from app.agents.state import AgentState
from app.gateway import get_langchain_llm
import logfire

# Portkey-backed LLM: fallback + cache + retry — same .invoke() interface as ChatGroq
llm = get_langchain_llm(feature="planner")

# Only the most recent turns go into the prompt, so long chats can't blow the context window.
HISTORY_TURNS = 8


def is_conversational(decision: str) -> bool:
    """
    LLMs often decorate a one-word answer ('CONVERSATIONAL.', '"conversational"').
    Normalise before comparing instead of requiring an exact string match.
    """
    return decision.strip(" \t\r\n\"'`.*").upper() == "CONVERSATIONAL"


def is_off_topic(decision: str) -> bool:
    """True when the planner flagged the message as unrelated to Kubernetes / Intel / networking."""
    return decision.strip(" \t\r\n\"'`.*").upper() == "OFF_TOPIC"


def format_history(messages: list, turns: int = HISTORY_TURNS) -> str:
    """Render the last `turns` messages (excluding the latest user message) as plain text."""
    history = ""
    for msg in messages[:-1][-turns:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        history += f"{role}: {msg['content']}\n"
    return history


def planner_node(state: AgentState):
    """
    The Planner determines if a search is needed based on the recent conversation.
    """
    history = format_history(state["messages"])

    user_message = state["messages"][-1]["content"] if state["messages"] else ""

    prompt = f"""
    You are an intelligent Assistant Planner. 
    Analyze the conversation history and the latest user message.
    
    CONVERSATION HISTORY:
    {history}
    
    LATEST MESSAGE:
    "{user_message}"
    
    Task:
    1. If the latest message is a greeting (hi, hello) or a question that can be answered using ONLY the conversation history above (e.g., "what is my name"), respond with 'CONVERSATIONAL'.
    2. If it is clearly unrelated to Kubernetes, Intel hardware, or enterprise networking (cooking, coffee, sports, movies, jokes, general trivia, ...) and is not answerable from the conversation history, respond with 'OFF_TOPIC'.
    3. If it is a technical question about Kubernetes, Intel, or Networking that requires fresh documentation, output a refined search query.
    
    Output ONLY 'CONVERSATIONAL', 'OFF_TOPIC' or the search query.
    """
    
    with logfire.span("🧠 Planner Decision"):
        decision = llm.invoke(prompt).content.strip()
        logfire.info(f"Intent identified: {decision}")
    
    if is_conversational(decision):
        return {
            "current_query": "CONVERSATIONAL",
            "status": "Handling conversationally (using memory)...",
            "plan": ["Intent: Conversational/Memory", "Retrieval: Skipped"]
        }
    
    if is_off_topic(decision):
        return {
            "current_query": "OFF_TOPIC",
            "status": "Off-topic request.",
            "plan": ["Intent: Off-topic", "Retrieval: Skipped"]
        }

    return {
        "current_query": decision,
        "status": f"Technical research needed. Searching for: {decision}",
        "plan": ["Intent: Technical", f"Search Term: {decision}"]
    }
