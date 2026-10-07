import logfire
from app.agents.state import AgentState
from app.services.retrieval.qdrant_service import search_enterprise_knowledge
from app.services.retrieval.ranking_service import rerank_results

def retrieve_node(state: AgentState):
    """
    Performs vector search and semantic reranking for technical queries.
    Keeps each chunk's source filename and score so the API can show where it came from.
    """
    query = state["current_query"]

    # Standard Retrieval Logic
    with logfire.span("🔍 Knowledge Retrieval"):
        logfire.info(f"Searching Qdrant for: {query}")
        raw_results = search_enterprise_knowledge(query, limit=15)
        logfire.info(f"Retrieved {len(raw_results)} candidates from Vector DB")

        with logfire.span("⚖️ Semantic Reranking"):
            reranked = rerank_results(query, raw_results, top_n=5)
            logfire.info(f"Reranking complete. Kept top {len(reranked)} most relevant chunks.")

        formatted_docs = [f"CONTENT: {r['content']}" for r in reranked]
        source_meta = [
            {"source": r.get("source", "Unknown"), "score": round(float(r.get("score", 0.0)), 4)}
            for r in reranked
        ]

    return {
        "documents": formatted_docs,
        "source_meta": source_meta,
        "status": "Found technical context." if formatted_docs else "No relevant context found.",
        "plan": state["plan"] + (["Context Retrieved"] if formatted_docs else ["No relevant context"]),
    }
