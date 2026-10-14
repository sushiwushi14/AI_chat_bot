import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.storage import init_db

init_db()
client = TestClient(app)



def test_health_endpoint():
    """Verify health endpoint returns status and provider configs."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "providers" in data
    assert "default_model" in data


def test_models_endpoint():
    """Verify models endpoint returns active models list."""
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert isinstance(data["models"], list)
    assert "default" in data


def test_thread_crud_lifecycle():
    """Verify thread creation, listing, retrieval, renaming, and deletion."""
    # 1. Create thread
    create_resp = client.post("/api/threads", json={"title": "Test Thread", "model": "gpt-4o"})
    assert create_resp.status_code == 201
    thread_data = create_resp.json()
    thread_id = thread_data["id"]
    assert thread_data["title"] == "Test Thread"

    # 2. List threads
    list_resp = client.get("/api/threads")
    assert list_resp.status_code == 200
    threads = list_resp.json()
    assert any(t["id"] == thread_id for t in threads)

    # 3. Get thread detail
    get_resp = client.get(f"/api/threads/{thread_id}")
    assert get_resp.status_code == 200
    detail = get_resp.json()
    assert detail["id"] == thread_id
    assert "messages" in detail

    # 4. Rename thread
    patch_resp = client.patch(f"/api/threads/{thread_id}", json={"title": "Renamed Thread"})
    assert patch_resp.status_code == 200
    renamed = patch_resp.json()
    assert renamed["title"] == "Renamed Thread"

    # 5. Delete thread
    del_resp = client.delete(f"/api/threads/{thread_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "deleted"

    # 6. Verify 404 after deletion
    get_again = client.get(f"/api/threads/{thread_id}")
    assert get_again.status_code == 404


def test_message_validation_rejects_empty():
    """Verify empty message payload returns 422 Unprocessable Entity."""
    resp = client.post("/api/chat", json={"message": "   "})
    assert resp.status_code == 422
