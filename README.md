# 🤖 SuperBot — Production LangGraph AI Assistant

<p align="center">
  <img src="https://img.shields.io/badge/LangGraph-1.2+-blue.svg" alt="LangGraph">
  <img src="https://img.shields.io/badge/LangChain-1.4+-green.svg" alt="LangChain">
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB.svg" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF.svg" alt="Vite">
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/Groq_LPU-Accelerated-F05A28.svg" alt="Groq">
  <img src="https://img.shields.io/badge/OpenAI-GPT--4o-412991.svg" alt="OpenAI">
</p>

A state-of-the-art, production-ready AI Chatbot application powered by **LangGraph**, **FastAPI**, and **React 18 / Vanilla Web UI**. Features multi-turn conversational memory, real-time Server-Sent Events (SSE) token streaming, reasoning `<think>` tag extraction, SQLite persistence, and multi-model support across Groq and OpenAI.

---

## 🌟 Key Features

- 🧠 **True Conversational Memory**:
  - Built with LangGraph's reducer architecture: `messages: Annotated[List[BaseMessage], add_messages]`.
  - Thread-level persistence via `MemorySaver` and `SqliteSaver` checkpointers ensuring cross-turn memory retention (e.g., remembering user details across sessions).
- ⚡ **Real-Time Token Streaming**:
  - Low-latency Server-Sent Events (SSE) streaming directly from LLMs via `astream`.
  - Abortable stream generation with live "Stop" controls.
- 💡 **Deep Reasoning & `<think>` Extraction**:
  - Automatically isolates `<think>...</think>` tags from reasoning models into expandable thinking blocks with token counts.
- 🚀 **Dual Provider Model Engine**:
  - **Groq LPU**: Ultra-fast inference with `Qwen 3.8 27B`, `GPT-OSS 120B`, and `GPT-OSS 20B`.
  - **OpenAI**: Flagship multimodal intelligence with `GPT-4o` and `GPT-4o Mini`.
- 🎨 **Modern, Sleek Interfaces**:
  - **Option 1 (Standalone Web UI)**: Integrated Vanilla JS + CSS3 frontend served directly by FastAPI at `http://localhost:8000`.
  - **Option 2 (Full-Stack React App)**: React 18 + TypeScript + TailwindCSS + Vite interface in `chatbot-app/` with sidebar history, theme switcher (Dark/Light), code syntax highlighting, copy buttons, and speech input.
- 🔒 **Enterprise-Ready**:
  - Sliding window IP rate limiting, input length validation, graceful retry logic, and zero frontend API key leakage.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Client["Client Tier"]
        UI1["Option A: React 18 + Vite UI (Port 5173)"]
        UI2["Option B: Built-in Web UI (Port 8000)"]
    end

    subgraph Server["FastAPI Backend (Port 8000)"]
        API["API Endpoints (/api/chat, /api/threads, /api/models)"]
        Limiter["Sliding Window Rate Limiter & CORS"]
        Storage["SQLite Storage (threads & messages)"]
        LLMFactory["LLM Factory Dispatcher"]
        
        API --> Limiter
        API --> Storage
        API --> GraphEngine
    end

    subgraph GraphEngine["LangGraph State Engine"]
        Checkpointer["SqliteSaver / MemorySaver Checkpointer"]
        Graph["StateGraph (START -> SuperBot -> END)"]
        SuperBotNode["SuperBot Execution Node"]
        
        Graph --> SuperBotNode
        Graph --> Checkpointer
        SuperBotNode --> LLMFactory
    end

    subgraph Providers["LLM Providers"]
        OpenAI["OpenAI (GPT-4o, GPT-4o Mini)"]
        Groq["Groq LPU (Qwen 3.8 27B, GPT-OSS)"]
    end

    Client <== "SSE Stream (token / thinking / done)" ==> Server
    LLMFactory --> OpenAI
    LLMFactory --> Groq
```

---

## 📁 Repository Structure

```text
├── app.py                     # Main FastAPI server launcher (Port 8000)
├── run.bat                    # One-click Windows runner for root app
├── requirement.txt            # Python dependencies
├── .env.example               # Template environment configuration
├── .gitignore                 # Comprehensive Git ignore rules
│
├── backend/                   # Root backend implementation
│   ├── bot_graph.py           # LangGraph StateGraph, MemorySaver & SSE streaming
│   └── server.py              # FastAPI endpoints & static file hosting
│
├── static/                    # Root Web UI
│   ├── index.html             # Responsive chat interface
│   ├── css/style.css          # Glassmorphic, modern CSS styles
│   └── js/app.js              # SSE consumer, audio/speech & chat logic
│
├── chatbot-app/               # Modular Full-Stack React + FastAPI App
│   ├── backend/               # Enterprise FastAPI service with SQLite persistence
│   │   ├── app/               # Routes, schemas, graph engine, storage
│   │   ├── Dockerfile         # Backend container definition
│   │   └── requirements.txt   # Backend requirements
│   ├── frontend/              # React 18 + TypeScript + Vite frontend
│   │   ├── src/               # ChatWindow, Composer, Sidebar, Hooks
│   │   └── package.json       # Frontend dependencies
│   ├── run_backend.bat        # Windows launcher for React app backend
│   ├── run_frontend.bat       # Windows launcher for Vite dev server
│   └── docker-compose.yml     # Multi-container orchestration
│
├── ChatBot/                   # Exploratory Jupyter Notebooks
│   └── 2-chatbot.ipynb        # Foundational LangGraph multi-turn notebook
└── langgraph/
    ├── basic.ipynb            # LangGraph introductory concepts
    └── chatbot.ipynb          # State graph prototyping
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Python**: Version `3.10` or higher
- **Node.js**: Version `18.x` or higher (only needed if running `chatbot-app` frontend)
- **API Keys**: An API key for [Groq](https://console.groq.com/) and/or [OpenAI](https://platform.openai.com/)

---

### 2. Environment Setup

Create a `.env` file in the root directory (refer to `.env.example`):

```bash
# Copy example configuration
cp .env.example .env
```

Add your API keys to `.env`:
```ini
OPENAI_API_KEY="your-openai-api-key-here"
GROQ_API_KEY="your-groq-api-key-here"
LANGCHAIN_API_KEY="your-optional-langchain-key"
```

---

### 3. Run Option A: Integrated Web UI (Quickest)

The root app serves both the backend API and the web interface from a single port:

```bash
# 1. Create and activate a virtual environment
python -m venv venv
.\venv\Scripts\activate   # On Windows (or 'source venv/bin/activate' on Linux/macOS)

# 2. Install dependencies
pip install -r requirement.txt

# 3. Launch the application
python app.py
# (Or on Windows simply double-click run.bat)
```

Open your browser and navigate to:  
👉 **[http://localhost:8000](http://localhost:8000)**

---

### 4. Run Option B: Full-Stack React App (`chatbot-app`)

If you want to use the full React 18 + TypeScript interface:

#### Start the Backend:
```bash
cd chatbot-app/backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# (Or double-click chatbot-app/run_backend.bat)
```

#### Start the Frontend:
```bash
cd chatbot-app/frontend
npm install
npm run dev
# (Or double-click chatbot-app/run_frontend.bat)
```

Open your browser and navigate to:  
👉 **[http://localhost:5173](http://localhost:5173)**

---

### 5. Run Option C: Docker Compose

To launch the full-stack containerized setup:

```bash
cd chatbot-app
docker-compose up --build
```

---

## 📡 API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service status & configured LLM provider keys check |
| `GET` | `/api/models` | List available models and provider availability |
| `POST` | `/api/chat/stream` | Token-level SSE streaming endpoint (`text/event-stream`) |
| `POST` | `/api/chat` | Synchronous / non-streaming chat fallback |
| `GET` | `/api/threads` | List saved conversation sessions (in `chatbot-app`) |
| `GET` | `/api/threads/{thread_id}` | Retrieve history turns for a specific thread |
| `DELETE` | `/api/threads/{thread_id}` | Delete or clear a conversation thread |

Interactive Swagger documentation is available at:  
👉 **[http://localhost:8000/docs](http://localhost:8000/docs)**

---

## 🧪 Testing

Run backend acceptance and unit tests:
```bash
# In chatbot-app/backend:
pytest tests/
python tests/verify_acceptance.py
```

Run frontend test suites:
```bash
# In chatbot-app/frontend:
npm test
```


---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
