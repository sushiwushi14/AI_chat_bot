import os
import sys
import time
from typing import Annotated, Dict, Any, List, Optional, AsyncGenerator
from typing_extensions import TypedDict
from dotenv import load_dotenv

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver

# Ensure .env is loaded
load_dotenv()

# Global memory saver for conversation thread persistence
checkpointer = MemorySaver()

# Model options
AVAILABLE_MODELS = [
    {
        "id": "qwen/qwen3.8-27b",
        "name": "Qwen 3.8 27B",
        "provider": "Groq",
        "badge": "⚡ Ultra Fast",
        "description": "High-speed reasoning and deep coding understanding via Groq LPU",
        "recommended": True
    },
    {
        "id": "openai/gpt-oss-120b",
        "name": "GPT-OSS 120B",
        "provider": "Groq",
        "badge": "🌟 120B Open",
        "description": "Massive open-weights foundation model powered by Groq",
        "recommended": False
    },
    {
        "id": "openai/gpt-oss-20b",
        "name": "GPT-OSS 20B",
        "provider": "Groq",
        "badge": "⚡ Light & Fast",
        "description": "Compact and super responsive open-weights model",
        "recommended": False
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "OpenAI",
        "badge": "🧠 Smart & Agile",
        "description": "OpenAI's efficient flagship-grade model with great balance",
        "recommended": False
    },
    {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "OpenAI",
        "badge": "🚀 Flagship",
        "description": "OpenAI's high-intelligence multimodal flagship model",
        "recommended": False
    }
]

class ChatState(TypedDict):
    """LangGraph state schema matching the 2-chatbot architecture."""
    messages: Annotated[List[BaseMessage], add_messages]


def get_llm(model_name: str = "qwen/qwen3.8-27b", temperature: float = 0.7):
    """Instantiate the appropriate LLM client based on model ID."""
    if model_name.startswith("gpt-"):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured in environment or .env file.")
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)
    else:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not configured in environment or .env file.")
        return ChatGroq(model=model_name, temperature=temperature, api_key=api_key)


def build_langgraph_bot(model_name: str = "qwen/qwen3.8-27b", temperature: float = 0.7):
    """
    Constructs a LangGraph StateGraph bot instance with START -> SuperBot -> END,
    matching the architecture from 2-chatbot.ipynb.
    """
    llm = get_llm(model_name, temperature)

    def superbot(state: ChatState):
        response = llm.invoke(state["messages"])
        return {"messages": [response]}

    builder = StateGraph(ChatState)
    builder.add_node("SuperBot", superbot)
    builder.add_edge(START, "SuperBot")
    builder.add_edge("SuperBot", END)

    return builder.compile(checkpointer=checkpointer)


# Global compiled graph
default_graph = build_langgraph_bot()


def get_thread_history(thread_id: str) -> List[Dict[str, str]]:
    """Retrieve message history for a given thread_id."""
    config = {"configurable": {"thread_id": thread_id}}
    state = default_graph.get_state(config)
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


def clear_thread_history(thread_id: str):
    """Clear state for a given thread_id by resetting checkpointer."""
    # MemorySaver stores checkpoint in storage dict
    config = {"configurable": {"thread_id": thread_id}}
    try:
        # Re-initialize state with empty messages
        default_graph.update_state(config, {"messages": []})
    except Exception:
        pass


async def stream_chat_response(
    thread_id: str,
    user_prompt: str,
    model_name: str = "qwen/qwen3.8-27b",
    temperature: float = 0.7,
    system_prompt: Optional[str] = None
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Streams tokens in real-time while updating LangGraph conversation state in MemorySaver.
    Yields chunks with {'token': '...'} and concludes with {'done': True, 'stats': ...}.
    """
    config = {"configurable": {"thread_id": thread_id}}
    start_time = time.time()
    
    # 1. Fetch current messages from state
    current_state = default_graph.get_state(config)
    existing_messages = list(current_state.values.get("messages", []))
    
    # 2. Build new message list
    messages_to_send: List[BaseMessage] = []
    
    # Add system prompt if this is the start of a thread or explicitly provided
    if system_prompt:
        # Check if first message is already system message
        if not existing_messages or not isinstance(existing_messages[0], SystemMessage):
            messages_to_send.append(SystemMessage(content=system_prompt))
    
    # Add existing conversation turns
    messages_to_send.extend(existing_messages)
    
    # Add the current human message
    new_human_msg = HumanMessage(content=user_prompt)
    messages_to_send.append(new_human_msg)
    
    # 3. Stream from the selected LLM
    llm = get_llm(model_name, temperature)
    accumulated_content = []
    token_count = 0
    
    try:
        async for chunk in llm.astream(messages_to_send):
            token_text = chunk.content
            if token_text:
                accumulated_content.append(token_text)
                token_count += 1
                yield {"token": token_text, "done": False}
    except Exception as e:
        yield {"error": str(e), "done": True}
        return

    full_ai_text = "".join(accumulated_content)
    elapsed_ms = int((time.time() - start_time) * 1000)
    
    # 4. Save both human message and AI response back into LangGraph state for this thread
    new_ai_msg = AIMessage(content=full_ai_text)
    default_graph.update_state(config, {"messages": [new_human_msg, new_ai_msg]})
    
    # 5. Emit completion metadata
    yield {
        "done": True,
        "full_text": full_ai_text,
        "stats": {
            "elapsed_ms": elapsed_ms,
            "approx_tokens": token_count,
            "model": model_name
        }
    }
