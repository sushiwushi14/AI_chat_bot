import os
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

# Search for .env in current directory or parent directory
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


class Settings:
    """Application configuration and environment settings."""
    PROJECT_NAME: str = "SuperBot AI"
    VERSION: str = "1.0.0"

    # API Keys
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")

    # Storage
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./chatbot.db")
    DB_FILE_PATH: str = os.getenv("DB_FILE_PATH", str(Path(__file__).resolve().parent.parent / "chatbot.db"))

    # Model Defaults
    DEFAULT_MODEL: str = os.getenv("DEFAULT_MODEL", "gpt-4o")
    DEFAULT_SYSTEM_PROMPT: str = os.getenv(
        "DEFAULT_SYSTEM_PROMPT",
        "You are SuperBot, a knowledgeable, concise, and helpful AI assistant."
    )

    # Security & Rate Limiting
    ALLOWED_ORIGINS_RAW: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    )
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    MAX_MESSAGE_LENGTH: int = int(os.getenv("MAX_MESSAGE_LENGTH", "4000"))

    @property
    def allowed_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS_RAW.split(",") if origin.strip()]


settings = Settings()

# Model Registry
# Note: Groq models like qwen-qwq-32b may be decommissioned; active replacements such as
# 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b', and 'openai/gpt-oss-20b' are configured here.
MODEL_REGISTRY: List[Dict[str, Any]] = [
    {
        "id": "gpt-4o",
        "label": "GPT-4o",
        "provider": "OpenAI",
        "badge": "🚀 Flagship",
        "description": "OpenAI's high-intelligence multimodal flagship model",
        "supports_thinking": False
    },
    {
        "id": "gpt-4o-mini",
        "label": "GPT-4o Mini",
        "provider": "OpenAI",
        "badge": "🧠 Fast & Smart",
        "description": "Fast and lightweight flagship-grade intelligence",
        "supports_thinking": False
    },
    {
        "id": "qwen/qwen3.8-27b",
        "label": "Qwen 3.8 27B",
        "provider": "Groq",
        "badge": "⚡ Ultra Fast",
        "description": "Ultra high-speed reasoning model powered by Groq LPU",
        "supports_thinking": True
    },
    {
        "id": "openai/gpt-oss-120b",
        "label": "GPT-OSS 120B",
        "provider": "Groq",
        "badge": "🌟 120B Open",
        "description": "Massive open-weights foundation model on Groq",
        "supports_thinking": False
    },
    {
        "id": "openai/gpt-oss-20b",
        "label": "GPT-OSS 20B",
        "provider": "Groq",
        "badge": "⚡ Light & Fast",
        "description": "Compact and super responsive open-weights model",
        "supports_thinking": False
    }
]

# Legacy / deprecated model alias mapping
MODEL_ALIASES: Dict[str, str] = {
    "qwen-qwq-32b": "qwen/qwen3.8-27b",
    "qwen-2.5-32b": "qwen/qwen3.8-27b"
}


def get_available_models() -> List[Dict[str, Any]]:
    """Returns only models whose API key is configured and non-empty."""
    has_openai = bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip())
    has_groq = bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())

    available = []
    for model in MODEL_REGISTRY:
        provider = model["provider"]
        if (provider == "OpenAI" and has_openai) or (provider == "Groq" and has_groq):
            available.append({**model, "available": True})
    return available


def resolve_model_id(model_id: Optional[str]) -> str:
    """Resolves model aliases and returns a valid model id or default fallback."""
    if not model_id or not model_id.strip():
        # Fallback to default
        available = get_available_models()
        if any(m["id"] == settings.DEFAULT_MODEL for m in available):
            return settings.DEFAULT_MODEL
        if available:
            return available[0]["id"]
        return settings.DEFAULT_MODEL

    clean_id = model_id.strip()
    # Check alias
    if clean_id in MODEL_ALIASES:
        return MODEL_ALIASES[clean_id]

    return clean_id
