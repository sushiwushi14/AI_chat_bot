import os
import sys
import json
import asyncio
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

# Ensure root is in python path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.bot_graph import (
    AVAILABLE_MODELS,
    stream_chat_response,
    get_thread_history,
    clear_thread_history,
    build_langgraph_bot,
    checkpointer
)
from langchain_core.messages import HumanMessage, AIMessage

app = FastAPI(
    title="SuperBot - LangGraph AI Assistant",
    description="Clean, modern, and high-performance front-end & API for LangGraph chatbot",
    version="1.0.0"
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    thread_id: str = Field(default="default_thread", description="Unique conversation session ID")
    message: str = Field(..., min_length=1, description="User message text")
    model: str = Field(default="qwen/qwen3.8-27b", description="Model identifier")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    system_prompt: Optional[str] = Field(default=None, description="Optional custom persona or system instruction")


class NonStreamChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    thread_id: str
    model: str
    stats: Dict[str, Any]


@app.get("/api/health")
async def health_check():
    has_groq = bool(os.getenv("GROQ_API_KEY"))
    has_openai = bool(os.getenv("OPENAI_API_KEY"))
    return {
        "status": "healthy",
        "keys": {
            "groq_configured": has_groq,
            "openai_configured": has_openai
        }
    }


@app.get("/api/models")
async def get_models():
    has_groq = bool(os.getenv("GROQ_API_KEY"))
    has_openai = bool(os.getenv("OPENAI_API_KEY"))
    
    # Filter or flag models based on available keys
    models_with_status = []
    for m in AVAILABLE_MODELS:
        is_available = (m["provider"] == "Groq" and has_groq) or (m["provider"] == "OpenAI" and has_openai)
        models_with_status.append({**m, "available": is_available})
        
    return {
        "models": models_with_status,
        "default": "qwen/qwen3.8-27b" if has_groq else "gpt-4o-mini"
    }


@app.get("/api/history/{thread_id}")
async def get_history(thread_id: str):
    history = get_thread_history(thread_id)
    return {"thread_id": thread_id, "messages": history}


@app.post("/api/threads/{thread_id}/clear")
async def clear_history(thread_id: str):
    clear_thread_history(thread_id)
    return {"status": "cleared", "thread_id": thread_id}


@app.post("/api/chat/stream")
async def chat_stream_endpoint(payload: ChatRequest):
    """
    Streams LLM tokens using Server-Sent Events (SSE).
    Each event is formatted as `data: {...}\n\n`.
    """
    async def sse_generator():
        try:
            async for chunk in stream_chat_response(
                thread_id=payload.thread_id,
                user_prompt=payload.message,
                model_name=payload.model,
                temperature=payload.temperature,
                system_prompt=payload.system_prompt
            ):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            err_data = {"error": str(e), "done": True}
            yield f"data: {json.dumps(err_data)}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/chat", response_model=NonStreamChatResponse)
async def chat_non_stream_endpoint(payload: ChatRequest):
    """Fallback non-streaming chat endpoint."""
    bot = build_langgraph_bot(model_name=payload.model, temperature=payload.temperature)
    config = {"configurable": {"thread_id": payload.thread_id}}
    
    response = bot.invoke({"messages": [HumanMessage(content=payload.message)]}, config=config)
    ai_message = response["messages"][-1]
    
    return NonStreamChatResponse(
        role="assistant",
        content=ai_message.content,
        thread_id=payload.thread_id,
        model=payload.model,
        stats={"tokens": len(ai_message.content.split())}
    )


# Serve Static files
STATIC_DIR = ROOT_DIR / "static"
if not STATIC_DIR.exists():
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "SuperBot API running. Frontend index.html not found yet."}
