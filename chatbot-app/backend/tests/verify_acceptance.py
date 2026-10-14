import os
import sys
from pathlib import Path

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.storage import init_db

init_db()
client = TestClient(app)

def test_acceptance_criteria():
    print("=== SuperBot Acceptance Verification ===")
    
    # 1. Health check
    h_resp = client.get("/api/health")
    assert h_resp.status_code == 200
    print("[PASS] 1. Backend health check:", h_resp.json())

    # 2. Models list
    m_resp = client.get("/api/models")
    assert m_resp.status_code == 200
    models_data = m_resp.json()
    print("[PASS] 2. Available models count:", len(models_data["models"]))
    print("         Models:", [m["id"] for m in models_data["models"]])

    # 3. Acceptance Criteria 2: Memory test across turns
    print("[RUN]  3. Testing Memory turn 1: 'Hi, my name is Krish and I like cricket'...")
    turn1_resp = client.post("/api/chat", json={
        "message": "Hi, my name is Krish and I like cricket",
        "model": "gpt-4o"
    })
    assert turn1_resp.status_code == 200, f"Turn 1 failed: {turn1_resp.text}"
    t1_data = turn1_resp.json()
    thread_id = t1_data["thread_id"]
    print(f"[PASS]    Turn 1 completed! Assigned thread_id: {thread_id}")
    print(f"         AI Response: {t1_data['content'][:60]}...")

    print("[RUN]     Testing Memory turn 2 with same thread_id: 'What is my name and hobby?'...")
    turn2_resp = client.post("/api/chat", json={
        "thread_id": thread_id,
        "message": "What is my name and hobby?",
        "model": "gpt-4o"
    })
    assert turn2_resp.status_code == 200, f"Turn 2 failed: {turn2_resp.text}"
    t2_data = turn2_resp.json()
    answer = t2_data["content"].lower()
    print(f"[PASS]    Turn 2 completed!")
    print(f"         AI Response: {t2_data['content']}")

    assert "krish" in answer, f"Expected 'krish' in response, got: {answer}"
    assert "cricket" in answer, f"Expected 'cricket' in response, got: {answer}"
    print("[PASS] Memory works perfectly! Bot retained name and hobby.")

    # 4. Verify thread history retrieval
    hist_resp = client.get(f"/api/threads/{thread_id}")
    assert hist_resp.status_code == 200
    history_data = hist_resp.json()
    print(f"[PASS] 4. Thread history verified! Stored messages count: {len(history_data['messages'])}")

    # 5. Invalid API key error handling
    print("[RUN]  5. Testing invalid model handling...")
    bad_resp = client.post("/api/chat", json={
        "message": "Hello",
        "model": "non-existent-model"
    })
    # Should return controlled 500 with friendly message
    assert bad_resp.status_code == 500
    print("[PASS] 5. Controlled error received:", bad_resp.json())

    print("\nALL ACCEPTANCE CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_acceptance_criteria()
