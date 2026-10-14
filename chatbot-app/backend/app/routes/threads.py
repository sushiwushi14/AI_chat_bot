import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status

from app.schemas import (
    ThreadResponse,
    ThreadDetailResponse,
    ThreadCreateRequest,
    ThreadRenameRequest
)
from app.storage import (
    list_threads,
    get_thread,
    create_thread,
    update_thread,
    delete_thread
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/threads", tags=["Threads"])


@router.get("", response_model=List[ThreadResponse])
async def get_threads(search: Optional[str] = Query(default=None, description="Optional search keyword")):
    """List all conversation threads, ordered by latest update."""
    try:
        return list_threads(search=search)
    except Exception as e:
        logger.error("Failed to list threads: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve threads."
        )


@router.post("", response_model=ThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_new_thread(payload: ThreadCreateRequest):
    """Create a new conversation thread."""
    try:
        new_thread = create_thread(title=payload.title, model=payload.model)
        return new_thread
    except Exception as e:
        logger.error("Failed to create thread: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create thread."
        )


@router.get("/{thread_id}", response_model=ThreadDetailResponse)
async def get_thread_detail(thread_id: str):
    """Retrieve thread details including its full conversation message history."""
    thread = get_thread(thread_id)
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread '{thread_id}' not found."
        )
    return thread


@router.patch("/{thread_id}", response_model=ThreadDetailResponse)
async def rename_thread(thread_id: str, payload: ThreadRenameRequest):
    """Rename a conversation thread title."""
    updated = update_thread(thread_id, title=payload.title)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread '{thread_id}' not found."
        )
    return updated


@router.delete("/{thread_id}")
async def delete_thread_endpoint(thread_id: str):
    """Delete a conversation thread and its messages."""
    success = delete_thread(thread_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thread '{thread_id}' not found."
        )
    return {"status": "deleted", "thread_id": thread_id}
