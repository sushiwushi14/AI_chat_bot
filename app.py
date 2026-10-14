import sys
import os

# Set UTF-8 encoding for standard output on Windows
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import uvicorn
from backend.server import app

if __name__ == "__main__":
    print("=======================================================")
    print("[*] SuperBot LangGraph Web UI starting on http://localhost:8000")
    print("[*] Open your browser and navigate to: http://localhost:8000")
    print("=======================================================")
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True)
