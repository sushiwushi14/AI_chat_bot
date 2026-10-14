import sqlite3
import uuid
import datetime
import logging
from typing import List, Optional, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


def get_db_connection() -> sqlite3.Connection:
    """Get a SQLite connection with dict row access and foreign key enforcement."""
    conn = sqlite3.connect(settings.DB_FILE_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Initialize database tables for threads and messages."""
    logger.info("Initializing SQLite database at %s", settings.DB_FILE_PATH)
    with get_db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS threads (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                thinking TEXT,
                model TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id)")
        conn.commit()


def generate_title_from_message(message: str, max_chars: int = 40) -> str:
    """Auto-generate a clean, concise thread title from the initial user prompt."""
    clean = " ".join(message.strip().split())
    if not clean:
        return "New Chat"

    # Split lines and take first line
    first_line = clean.split("\n")[0].strip()
    if len(first_line) <= max_chars:
        return first_line

    # Truncate at word boundary
    truncated = first_line[:max_chars]
    last_space = truncated.rfind(" ")
    if last_space > 15:
        truncated = truncated[:last_space]

    return truncated + "..."


def list_threads(search: Optional[str] = None) -> List[Dict[str, Any]]:
    """List threads ordered by updated_at desc, with optional search filtering."""
    with get_db_connection() as conn:
        if search and search.strip():
            query = """
                SELECT t.id, t.title, t.model, t.created_at, t.updated_at,
                       COUNT(m.id) as message_count
                FROM threads t
                LEFT JOIN messages m ON t.id = m.thread_id
                WHERE t.title LIKE ? OR m.content LIKE ?
                GROUP BY t.id
                ORDER BY t.updated_at DESC
            """
            term = f"%{search.strip()}%"
            rows = conn.execute(query, (term, term)).fetchall()
        else:
            query = """
                SELECT t.id, t.title, t.model, t.created_at, t.updated_at,
                       COUNT(m.id) as message_count
                FROM threads t
                LEFT JOIN messages m ON t.id = m.thread_id
                GROUP BY t.id
                ORDER BY t.updated_at DESC
            """
            rows = conn.execute(query).fetchall()

        return [dict(r) for r in rows]


def get_thread(thread_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve thread metadata along with its full messages list."""
    with get_db_connection() as conn:
        thread_row = conn.execute(
            "SELECT id, title, model, created_at, updated_at FROM threads WHERE id = ?",
            (thread_id,)
        ).fetchone()

        if not thread_row:
            return None

        messages_rows = conn.execute(
            """
            SELECT id, role, content, thinking, created_at
            FROM messages
            WHERE thread_id = ?
            ORDER BY created_at ASC
            """,
            (thread_id,)
        ).fetchall()

        thread_dict = dict(thread_row)
        thread_dict["messages"] = [dict(m) for m in messages_rows]
        return thread_dict


def create_thread(
    thread_id: Optional[str] = None,
    title: Optional[str] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new thread entry in SQLite."""
    tid = thread_id if thread_id and thread_id.strip() else f"thr_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    t_title = title.strip() if title and title.strip() else "New Chat"

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO threads (id, title, model, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (tid, t_title, model or settings.DEFAULT_MODEL, now_iso, now_iso)
        )
        conn.commit()

    return {
        "id": tid,
        "title": t_title,
        "model": model or settings.DEFAULT_MODEL,
        "created_at": now_iso,
        "updated_at": now_iso,
        "message_count": 0
    }


def update_thread(
    thread_id: str,
    title: Optional[str] = None,
    model: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Update thread title or model, bumping updated_at timestamp."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with get_db_connection() as conn:
        existing = conn.execute("SELECT id, title, model FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if not existing:
            return None

        new_title = title if title is not None else existing["title"]
        new_model = model if model is not None else existing["model"]

        conn.execute(
            """
            UPDATE threads
            SET title = ?, model = ?, updated_at = ?
            WHERE id = ?
            """,
            (new_title, new_model, now_iso, thread_id)
        )
        conn.commit()

    return get_thread(thread_id)


def delete_thread(thread_id: str) -> bool:
    """Delete a thread and its messages from SQLite."""
    with get_db_connection() as conn:
        cursor = conn.execute("DELETE FROM threads WHERE id = ?", (thread_id,))
        conn.commit()
        return cursor.rowcount > 0


def save_message(
    thread_id: str,
    role: str,
    content: str,
    thinking: Optional[str] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """Save an incoming user or assistant message to SQLite and bump thread updated_at."""
    mid = f"msg_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO messages (id, thread_id, role, content, thinking, model, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (mid, thread_id, role, content, thinking, model, now_iso)
        )
        conn.execute(
            "UPDATE threads SET updated_at = ? WHERE id = ?",
            (now_iso, thread_id)
        )
        conn.commit()

    return {
        "id": mid,
        "role": role,
        "content": content,
        "thinking": thinking,
        "created_at": now_iso
    }
