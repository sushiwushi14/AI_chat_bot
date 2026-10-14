@echo off
echo Starting SuperBot Backend on http://127.0.0.1:8000 ...
cd backend
..\..\venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
pause
