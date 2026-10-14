from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    """Payload for chat and chat stream endpoints."""
    thread_id: Optional[str] = Field(
        default=None,
        description="Conversation session / thread ID. If omitted, a new thread ID is created."
    )
    message: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="User message content."
    )
    model: Optional[str] = Field(
        default=None,
        description="Target model ID (e.g. 'gpt-4o', 'qwen/qwen3.8-27b')."
    )
    temperature: Optional[float] = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature for LLM generation."
    )
    system_prompt: Optional[str] = Field(
        default=None,
        description="Optional custom system persona / instructions."
    )

    @field_validator("message")
    @classmethod
    def validate_message_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Message cannot be empty or pure whitespace.")
        return stripped


class ChatResponse(BaseModel):
    """Response payload for non-streaming chat endpoint."""
    role: str = "assistant"
    content: str
    thinking: Optional[str] = None
    thread_id: str
    model: str
    usage: Optional[Dict[str, Any]] = None


class ModelInfoResponse(BaseModel):
    id: str
    label: str
    provider: str
    badge: Optional[str] = None
    description: Optional[str] = None
    available: bool = True
    supports_thinking: bool = False


class ModelListResponse(BaseModel):
    models: List[ModelInfoResponse]
    default: str


class ThreadCreateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=100)
    model: Optional[str] = Field(default=None)


class ThreadRenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Title cannot be empty.")
        return clean


class MessageRecordResponse(BaseModel):
    id: str
    role: str
    content: str
    thinking: Optional[str] = None
    created_at: str


class ThreadResponse(BaseModel):
    id: str
    title: str
    model: Optional[str] = None
    created_at: str
    updated_at: str
    message_count: int = 0


class ThreadDetailResponse(BaseModel):
    id: str
    title: str
    model: Optional[str] = None
    created_at: str
    updated_at: str
    messages: List[MessageRecordResponse]


class HealthResponse(BaseModel):
    status: str
    providers: Dict[str, bool]
    default_model: str
    version: str
