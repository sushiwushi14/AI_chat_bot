import os
import logging
from typing import Optional
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from app.config import settings, resolve_model_id, MODEL_REGISTRY

logger = logging.getLogger(__name__)


def get_model_provider(model_id: str) -> str:
    """Identify provider based on registry or model prefix."""
    for entry in MODEL_REGISTRY:
        if entry["id"] == model_id:
            return entry["provider"]

    # Fallback heuristic
    if model_id.startswith("gpt-") or model_id.startswith("o1") or model_id.startswith("o3"):
        return "OpenAI"
    return "Groq"


def get_llm(model_id: Optional[str] = None, temperature: float = 0.7) -> BaseChatModel:
    """
    Factory function returning the appropriate Chat model instance (ChatGroq or ChatOpenAI).
    Raises ValueError with a clear user-facing error message if required API key is missing.
    """
    resolved_id = resolve_model_id(model_id)
    provider = get_model_provider(resolved_id)

    logger.info("Instantiating LLM for model_id: '%s' (resolved: '%s', provider: %s, temp: %.2f)",
                model_id, resolved_id, provider, temperature)

    if provider == "OpenAI":
        api_key = settings.OPENAI_API_KEY
        if not api_key or not api_key.strip():
            raise ValueError(
                "OpenAI API key is missing or not configured. "
                "Please configure OPENAI_API_KEY in your .env file."
            )
        return ChatOpenAI(
            model=resolved_id,
            temperature=temperature,
            api_key=api_key,
            streaming=True
        )

    elif provider == "Groq":
        api_key = settings.GROQ_API_KEY
        if not api_key or not api_key.strip():
            raise ValueError(
                "Groq API key is missing or not configured. "
                "Please configure GROQ_API_KEY in your .env file."
            )
        return ChatGroq(
            model=resolved_id,
            temperature=temperature,
            api_key=api_key,
            streaming=True
        )

    else:
        raise ValueError(f"Unsupported model provider: '{provider}' for model '{resolved_id}'.")
