import json
import logging
import re
from typing import AsyncGenerator, Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from app.schemas import (
    ChatRequest,
    ChatResponse,
    ModelListResponse
)
from app.config import (
    settings,
    get_available_models,
    resolve_model_id
)
from app.graph import (
    get_or_build_graph,
    prepare_input_messages
)
from app.storage import (
    get_thread,
    create_thread,
    save_message,
    update_thread,
    generate_title_from_message
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Chat"])


class ThinkingStreamProcessor:
    """
    Stream parser that detects <think>...</think> XML tags emitted by reasoning models
    and splits the chunks into 'thinking' and 'token' events, even across fragmented tokens.
    """
    def __init__(self):
        self.in_thinking = False
        self.buffer = ""
        self.thinking_text: List[str] = []
        self.content_text: List[str] = []

    def feed(self, chunk: str) -> List[tuple[str, str]]:
        events = []
        text = self.buffer + chunk
        self.buffer = ""

        while text:
            if not self.in_thinking:
                if "<think>" in text:
                    idx = text.find("<think>")
                    pre = text[:idx]
                    if pre:
                        events.append(("token", pre))
                        self.content_text.append(pre)
                    self.in_thinking = True
                    text = text[idx + len("<think>"):]
                else:
                    # check for partial start tag at end
                    matched_partial = False
                    for i in range(1, len("<think>")):
                        if text.endswith("<think>"[:i]):
                            self.buffer = text[-i:]
                            pre = text[:-i]
                            if pre:
                                events.append(("token", pre))
                                self.content_text.append(pre)
                            matched_partial = True
                            text = ""
                            break
                    if not matched_partial:
                        events.append(("token", text))
                        self.content_text.append(text)
                        text = ""
            else:
                if "</think>" in text:
                    idx = text.find("</think>")
                    pre = text[:idx]
                    if pre:
                        events.append(("thinking", pre))
                        self.thinking_text.append(pre)
                    self.in_thinking = False
                    text = text[idx + len("</think>"):]
                else:
                    matched_partial = False
                    for i in range(1, len("</think>")):
                        if text.endswith("</think>"[:i]):
                            self.buffer = text[-i:]
                            pre = text[:-i]
                            if pre:
                                events.append(("thinking", pre))
                                self.thinking_text.append(pre)
                            matched_partial = True
                            text = ""
                            break
                    if not matched_partial:
                        events.append(("thinking", text))
                        self.thinking_text.append(text)
                        text = ""
        return events

    def finalize(self) -> List[tuple[str, str]]:
        events = []
        if self.buffer:
            if self.in_thinking:
                events.append(("thinking", self.buffer))
                self.thinking_text.append(self.buffer)
            else:
                events.append(("token", self.buffer))
                self.content_text.append(self.buffer)
            self.buffer = ""
        return events

    @property
    def full_thinking(self) -> str:
        return "".join(self.thinking_text).strip()

    @property
    def full_content(self) -> str:
        return "".join(self.content_text).strip()


@router.get("/models", response_model=ModelListResponse)
async def list_models_endpoint():
    """Returns available models that have valid configured API keys."""
    available = get_available_models()
    default_m = resolve_model_id(settings.DEFAULT_MODEL)
    return ModelListResponse(
        models=available,
        default=default_m
    )


@router.post("/chat/stream")
async def chat_stream_endpoint(payload: ChatRequest, request: Request):
    """
    Real-time streaming chat endpoint using Server-Sent Events (SSE) over POST.
    Dispatches via LangGraph `graph.astream(..., stream_mode='messages')`.
    """
    model_id = resolve_model_id(payload.model)
    thread_id = payload.thread_id

    # 1. Ensure thread exists or create new one
    thread = get_thread(thread_id) if thread_id else None
    is_new_thread = False
    if not thread:
        is_new_thread = True
        auto_title = generate_title_from_message(payload.message)
        thread = create_thread(thread_id=thread_id, title=auto_title, model=model_id)
        thread_id = thread["id"]
    else:
        # If thread was empty or titled 'New Chat', update title
        if thread["title"] == "New Chat":
            auto_title = generate_title_from_message(payload.message)
            update_thread(thread_id, title=auto_title, model=model_id)

    # 2. Persist the incoming user message to SQLite
    save_message(
        thread_id=thread_id,
        role="user",
        content=payload.message,
        model=model_id
    )

    # 3. Stream generator
    async def sse_event_stream() -> AsyncGenerator[str, None]:
        processor = ThinkingStreamProcessor()
        usage_metadata: Optional[Dict[str, Any]] = None

        try:
            # Build or retrieve compiled LangGraph for this model
            graph = get_or_build_graph(model_id=model_id, temperature=payload.temperature)

            # Prepare message turn with checkpoint memory
            input_messages = prepare_input_messages(
                graph=graph,
                thread_id=thread_id,
                user_message=payload.message,
                system_prompt=payload.system_prompt
            )

            config = {"configurable": {"thread_id": thread_id}}

            # Stream message chunks from LangGraph
            async for chunk, meta in graph.astream(
                {"messages": input_messages},
                config=config,
                stream_mode="messages"
            ):
                # Inspect usage metadata if provided on the final chunk
                if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                    usage_metadata = chunk.usage_metadata

                content = chunk.content
                if content:
                    events = processor.feed(content)
                    for event_type, text in events:
                        if text:
                            # Standard SSE format: event: ...\ndata: ...\n\n
                            data_payload = json.dumps({"content": text, "event": event_type})
                            yield f"event: {event_type}\ndata: {data_payload}\n\n"

            # Flush any remaining buffer in processor
            final_events = processor.finalize()
            for event_type, text in final_events:
                if text:
                    data_payload = json.dumps({"content": text, "event": event_type})
                    yield f"event: {event_type}\ndata: {data_payload}\n\n"

            final_thinking = processor.full_thinking or None
            final_content = processor.full_content

            # Persist assistant response to SQLite
            save_message(
                thread_id=thread_id,
                role="assistant",
                content=final_content,
                thinking=final_thinking,
                model=model_id
            )

            # Emit final completion event
            thread_data = get_thread(thread_id)
            current_title = thread_data["title"] if thread_data else "Chat"

            done_payload = {
                "message": final_content,
                "thinking": final_thinking,
                "thread_id": thread_id,
                "title": current_title,
                "model": model_id,
                "usage": usage_metadata
            }
            yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

        except Exception as e:
            logger.error("Error during streaming for thread %s: %s", thread_id, e, exc_info=True)
            # Provide clean, human-readable error without exposing internals or keys
            err_msg = str(e)
            if "api_key" in err_msg.lower() or "authentication" in err_msg.lower() or "unauthorized" in err_msg.lower():
                user_err = "Authentication failed: Please verify that your API key is valid in the .env configuration."
            elif "rate" in err_msg.lower() and "limit" in err_msg.lower():
                user_err = "Provider rate limit reached. Please wait a moment before trying again."
            elif "decommissioned" in err_msg.lower() or "not found" in err_msg.lower():
                user_err = f"The requested model '{model_id}' is unavailable or decommissioned by the provider."
            else:
                user_err = f"Inference error: {err_msg}"

            err_payload = json.dumps({"error": user_err})
            yield f"event: error\ndata: {err_payload}\n\n"

    return StreamingResponse(
        sse_event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_non_streaming_endpoint(payload: ChatRequest):
    """Fallback non-streaming chat endpoint returning a JSON response."""
    model_id = resolve_model_id(payload.model)
    thread_id = payload.thread_id

    # 1. Ensure thread exists or create
    thread = get_thread(thread_id) if thread_id else None
    if not thread:
        auto_title = generate_title_from_message(payload.message)
        thread = create_thread(thread_id=thread_id, title=auto_title, model=model_id)
        thread_id = thread["id"]

    # 2. Persist user message
    save_message(
        thread_id=thread_id,
        role="user",
        content=payload.message,
        model=model_id
    )

    try:
        graph = get_or_build_graph(model_id=model_id, temperature=payload.temperature)
        input_messages = prepare_input_messages(
            graph=graph,
            thread_id=thread_id,
            user_message=payload.message,
            system_prompt=payload.system_prompt
        )

        config = {"configurable": {"thread_id": thread_id}}
        response = graph.invoke({"messages": input_messages}, config=config)

        ai_message = response["messages"][-1]
        raw_content = ai_message.content

        # Extract <think> if present
        thinking_text = None
        content_text = raw_content
        think_match = re.search(r"<think>(.*?)</think>", raw_content, flags=re.DOTALL)
        if think_match:
            thinking_text = think_match.group(1).strip()
            content_text = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL).strip()

        # Save assistant message
        save_message(
            thread_id=thread_id,
            role="assistant",
            content=content_text,
            thinking=thinking_text,
            model=model_id
        )

        usage = getattr(ai_message, "usage_metadata", None)

        return ChatResponse(
            role="assistant",
            content=content_text,
            thinking=thinking_text,
            thread_id=thread_id,
            model=model_id,
            usage=usage
        )

    except Exception as e:
        logger.error("Error in non-streaming chat endpoint: %s", e, exc_info=True)
        err_msg = str(e)
        if "api_key" in err_msg.lower() or "authentication" in err_msg.lower() or "unauthorized" in err_msg.lower():
            detail = "Authentication failed: Please verify that your API key is valid in the .env configuration."
        else:
            detail = f"Inference error: {err_msg}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)
