from typing import TypedDict, List, Annotated

# Sentinel used to replace the saved history instead of appending to it.
REPLACE_KEY = "__replace__"


def merge_messages(left: List[dict], right: List[dict]) -> List[dict]:
    """
    Reducer for `messages`.
    Normal updates are appended (conversation memory). A single item of the form
    {"__replace__": [...]} replaces the whole history, which is how the API rewinds a
    thread so the server's memory matches what the user sees (stop / regenerate / edit).
    """
    if right and isinstance(right[0], dict) and REPLACE_KEY in right[0]:
        return list(right[0][REPLACE_KEY])
    return (left or []) + (right or [])


class AgentState(TypedDict):
    # Messages are appended to the history (see merge_messages) rather than replaced.
    messages: Annotated[List[dict], merge_messages]
    current_query: str
    documents: List[str]
    source_meta: List[dict]
    plan: List[str]
    status: str
    final_answer: str
