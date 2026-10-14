import sqlite3
import logging
from typing import Annotated, Dict, Any, List, Optional
from typing_extensions import TypedDict
from pathlib import Path

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.memory import MemorySaver

from app.config import settings, resolve_model_id
from app.llm_factory import get_llm

logger = logging.getLogger(__name__)

# Core State schema preserved from notebook
class State(TypedDict):
    messages: Annotated[list, add_messages]


# Global checkpointer instance supporting both synchronous and asynchronous invocations
_checkpointer_instance = MemorySaver()


def get_checkpointer():
    """Returns singleton checkpointer instance (MemorySaver supporting both sync and async graph streaming)."""
    return _checkpointer_instance



# Cache for compiled graphs keyed by (model_id, temperature)
_graph_cache: Dict[str, Any] = {}


def build_superbot_node(llm: BaseChatModel):
    """
    Builds the 'SuperBot' node callable.
    Preserves the notebook contract: calls llm.invoke(state['messages']) and
    returns {'messages': [response]}. RunnableConfig is forwarded to enable
    token-level callbacks during graph.astream(..., stream_mode='messages').
    """
    def superbot(state: State, config: Optional[RunnableConfig] = None):
        response = llm.invoke(state["messages"], config=config)
        return {"messages": [response]}

    return superbot


def get_or_build_graph(model_id: Optional[str] = None, temperature: float = 0.7):
    """
    Returns a cached compiled LangGraph instance for the specified model and temperature.
    Builds and caches if not previously created.
    """
    resolved_id = resolve_model_id(model_id)
    cache_key = f"{resolved_id}:{temperature:.2f}"

    if cache_key in _graph_cache:
        return _graph_cache[cache_key]

    logger.info("Compiling new LangGraph for model '%s' (temp=%.2f)", resolved_id, temperature)
    llm = get_llm(resolved_id, temperature)
    node_func = build_superbot_node(llm)

    builder = StateGraph(State)
    builder.add_node("SuperBot", node_func)
    builder.add_edge(START, "SuperBot")
    builder.add_edge("SuperBot", END)

    checkpointer = get_checkpointer()
    compiled_graph = builder.compile(checkpointer=checkpointer)

    _graph_cache[cache_key] = compiled_graph
    return compiled_graph


def prepare_input_messages(
    graph,
    thread_id: str,
    user_message: str,
    system_prompt: Optional[str] = None
) -> List[BaseMessage]:
    """
    Prepares the message payload for this turn.
    If the thread does not yet have any history in state, prepends the configured
    SystemMessage. Otherwise, sends only the new HumanMessage, allowing the checkpointer
    to supply the conversational memory.
    """
    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)
    existing_messages = state.values.get("messages", [])

    messages_to_send: List[BaseMessage] = []

    # If first turn in this thread, add system prompt
    if not existing_messages:
        active_prompt = system_prompt or settings.DEFAULT_SYSTEM_PROMPT
        if active_prompt and active_prompt.strip():
            messages_to_send.append(SystemMessage(content=active_prompt.strip()))

    messages_to_send.append(HumanMessage(content=user_message))
    return messages_to_send


def get_graph_thread_history(graph, thread_id: str) -> List[Dict[str, str]]:
    """Retrieve message history stored directly within LangGraph checkpointer state."""
    config = {"configurable": {"thread_id": thread_id}}
    state = graph.get_state(config)
    messages = state.values.get("messages", [])

    result = []
    for msg in messages:
        if isinstance(msg, HumanMessage):
            result.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            result.append({"role": "assistant", "content": msg.content})
        elif isinstance(msg, SystemMessage):
            result.append({"role": "system", "content": msg.content})
    return result
