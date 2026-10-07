import logfire
from app.agents.state import AgentState
from app.agents.nodes.planner import format_history
from app.gateway import portkey_client, extract_cache_status
from app.guardrails.classifier import RESPONSES, OFF_TOPIC

NO_CONTEXT_ANSWER = (
    "I couldn't find anything relevant in the documentation for that question. "
    "Try rephrasing it, or ask about a topic covered by the knowledge base."
)


def generate_node(state: AgentState):
    """
    Synthesizes a response using both Documentation Context AND Conversation History.
    Uses the native Portkey client (not LangChain) so we can read the
    x-portkey-cache-status response header and surface Cache: Hit in the UI.
    """
    query = state["current_query"]

    history_str = format_history(state["messages"])

    user_msg = state["messages"][-1]["content"] if state["messages"] else ""

    if query == "OFF_TOPIC":
        # Safety net behind the guardrail gate: refuse without retrieval or an LLM call.
        answer = RESPONSES[OFF_TOPIC]
        return {
            "final_answer": answer,
            "status": "Off-topic request.",
            "plan": state["plan"],
            "messages": [{"role": "assistant", "content": answer}],
        }

    if query == "CONVERSATIONAL":
        logfire.info("Generating conversational response using memory.")
        prompt = f"""
        You are a friendly and helpful Enterprise AI Assistant.
        Answer the user's latest message using the CONVERSATION HISTORY below.

        CONVERSATION HISTORY:
        {history_str}

        LATEST MESSAGE:
        "{user_msg}"
        """
    else:
        if not state.get("documents"):
            # Nothing relevant was retrieved: say so instead of letting the LLM improvise.
            logfire.warning("No relevant context retrieved — returning an honest 'not found' answer.")
            return {
                "final_answer": NO_CONTEXT_ANSWER,
                "status": "No relevant context found.",
                "plan": state["plan"],
                "messages": [{"role": "assistant", "content": NO_CONTEXT_ANSWER}],
            }

        logfire.info("Generating technical RAG response.")
        max_context_chars = 25000
        full_context = ""

        for n, doc in enumerate(state["documents"], start=1):
            numbered = f"[{n}] {doc}"
            if len(full_context) + len(numbered) < max_context_chars:
                full_context += numbered + "\n\n"
            else:
                logfire.warning("Context truncated to fit Groq TPM limits.")
                break

        prompt = f"""
        You are a Senior Technical Architect.
        Answer the question using ONLY the TECHNICAL CONTEXT provided. Do not use outside knowledge.
        If the context does not actually answer the question (for example it is unrelated or only
        fragments), say you could not find that in the documentation instead of guessing.
        Each context passage is numbered like [1], [2]. Cite the passages you rely on
        inline using footnote-style markers [^1], [^2] that match those numbers
        (e.g. "...uses a CNI plugin [^2]."). Only cite numbers that exist, and do not add
        a separate references list.

        TECHNICAL CONTEXT:
        {full_context}

        CONVERSATION HISTORY:
        {history_str}

        USER QUESTION:
        "{user_msg}"
        """

    with logfire.span("✍️ LLM Synthesis"):
        try:
            response = portkey_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1
            )
            content = response.choices[0].message.content
            cache_status = extract_cache_status(response)
            is_cache_hit = cache_status == "HIT"

            if is_cache_hit:
                logfire.info("⚡ Gateway Cache Hit — response served from Portkey cache.")
                plan_update = state["plan"] + ["Cache: Hit ⚡"]
                status = "Cache hit — instant response."
            else:
                logfire.info("✅ Response synthesised via LLM.")
                plan_update = state["plan"]
                status = "Response generated."

            return {
                "final_answer": content,
                "status": status,
                "plan": plan_update,
                "messages": [{"role": "assistant", "content": content}]
            }

        except Exception as e:
            logfire.error(f"LLM Generation failed: {e}")
            raise e
