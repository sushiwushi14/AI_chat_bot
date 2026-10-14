import time
import logging
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Dict, List

from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.storage import init_db
from app.graph import get_checkpointer
from app.schemas import HealthResponse
from app.routes.chat import router as chat_router
from app.routes.threads import router as threads_router

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s"
)
logger = logging.getLogger("superbot")


# Simple in-memory sliding window rate limiter per client IP
class SimpleRateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.rpm = requests_per_minute
        self.window_seconds = 60
        self.ip_records: Dict[str, List[float]] = defaultdict(list)

    def is_rate_limited(self, ip: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        records = [ts for ts in self.ip_records[ip] if ts > cutoff]
        self.ip_records[ip] = records

        if len(records) >= self.rpm:
            return True

        self.ip_records[ip].append(now)
        return False


rate_limiter = SimpleRateLimiter(requests_per_minute=settings.RATE_LIMIT_PER_MINUTE)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and graceful shutdown."""
    logger.info("Initializing SuperBot AI backend...")
    init_db()
    # Eagerly prepare checkpointer
    get_checkpointer()
    logger.info("Backend initialized successfully. Listening for requests.")
    yield
    logger.info("SuperBot AI backend shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade LangGraph Chatbot Backend with SSE streaming and checkpointer memory.",
    lifespan=lifespan
)

# Configure CORS
origins = settings.allowed_origins
logger.info("Configuring CORS for allowed origins: %s", origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limiting_and_timing_middleware(request: Request, call_next):
    """Enforces per-IP rate limiting on API mutations and logs request duration."""
    client_ip = request.client.host if request.client else "unknown"

    # Only rate-limit API write endpoints
    if request.url.path.startswith("/api/chat") and request.method == "POST":
        if rate_limiter.is_rate_limited(client_ip):
            logger.warning("Rate limit exceeded for IP %s on %s", client_ip, request.url.path)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"error": "Rate limit exceeded. Please wait a minute before making more requests."}
            )

    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        response.headers["X-Process-Time"] = f"{process_time:.1f}ms"
        return response
    except Exception as exc:
        process_time = (time.time() - start_time) * 1000
        logger.error("Unhandled error processing %s %s (%.1fms): %s",
                     request.method, request.url.path, process_time, exc, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "An internal server error occurred."}
        )


# Health check endpoint
@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint exposing status and configured provider availability."""
    has_openai = bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip())
    has_groq = bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())
    return HealthResponse(
        status="healthy",
        providers={
            "openai": has_openai,
            "groq": has_groq
        },
        default_model=settings.DEFAULT_MODEL,
        version=settings.VERSION
    )


# Include Routers
app.include_router(chat_router)
app.include_router(threads_router)
