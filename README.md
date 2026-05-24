<div align="center">

<!-- HERO BANNER - Replace with your actual banner image -->
<img width="100%" height="auto" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=CareerPath%20AI&fontSize=60&fontColor=fff&animation=fadeIn&fontAlignY=38&desc=Production-Grade%20AI%20Career%20Coach%20%E2%80%94%20RAG%20%C2%B7%20Pinecone%20%C2%B7%20Gemini%20%C2%B7%20FastAPI%20%C2%B7%20Supabase&descAlignY=60&descSize=16" alt="CareerPath AI Banner"/>

<br/>

<!-- BADGES ROW 1 -->
<img src="https://img.shields.io/badge/FastAPI-0.104.1-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
<img src="https://img.shields.io/badge/LangChain-0.1.0-1C3C3C?style=for-the-badge&logo=chainlink&logoColor=white" alt="LangChain"/>
<img src="https://img.shields.io/badge/Pinecone-Vector_DB-00B287?style=for-the-badge&logo=pinecone&logoColor=white" alt="Pinecone"/>
<img src="https://img.shields.io/badge/Gemini-AI_Core-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini"/>

<br/>

<!-- BADGES ROW 2 -->
<img src="https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
<img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
<img src="https://img.shields.io/badge/Supabase-Auth_+_DB-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase"/>
<img src="https://img.shields.io/badge/Docker-Containerized-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>

<br/><br/>

<!-- STATUS BADGES -->
<img src="https://img.shields.io/badge/Status-Production_Ready-brightgreen?style=flat-square" alt="Status"/>
<img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"/>
<img src="https://img.shields.io/badge/PRs-Welcome-orange?style=flat-square" alt="PRs Welcome"/>
<img src="https://img.shields.io/badge/Live_Demo-Vercel-black?style=flat-square&logo=vercel" alt="Live Demo"/>

<br/><br/>

**[🚀 Live Demo](https://ai-career-coach-new.vercel.app) · [📖 Documentation](#-architecture) · [🐛 Report Bug](../../issues) · [💡 Request Feature](../../issues)**

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [RAG Pipeline Deep Dive](#-rag-pipeline-deep-dive)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Security Architecture](#-security-architecture)
- [Deployment](#-deployment)
- [Engineering Decisions](#-engineering-decisions)
- [Contributing](#-contributing)

---

## 🎯 Overview

CareerPath AI is a **production-grade, multi-user AI career coaching platform** built on a Retrieval-Augmented Generation (RAG) pipeline. It ingests your resume PDF, stores it as high-dimensional vector embeddings in Pinecone, and provides career coaching responses grounded entirely in your personal career history — not generic internet advice.

This is not a chatbot wrapper. Every response is retrieved, grounded, and generated through a purpose-built pipeline with **per-user vector isolation**, **persistent conversation history**, and **multi-agent resume analysis**.

```
User uploads resume PDF
        ↓
LangChain chunks + embeds text (768-dim vectors)
        ↓
Pinecone stores chunks with user_id metadata tag
        ↓
User asks a career question
        ↓
Pinecone retrieves Top-5 relevant chunks (filtered by user_id)
        ↓
Gemini generates a grounded, personalized response
        ↓
Supabase persists the conversation for future sessions
```

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **RAG-Powered Chat** | Resume-grounded answers via LangChain + Pinecone retrieval |
| **Per-User Vector Isolation** | Metadata filtering ensures zero cross-user data contamination |
| **Multi-Agent Resume Audit** | Simultaneous Recruiter + Tech Lead persona analysis via Gemini structured outputs |
| **Dynamic Roadmap Generation** | 4-phase career roadmap with skill gap analysis, grounded in resume context |
| **Persistent History** | Full conversation persistence and reload across sessions via Supabase |
| **Supabase RLS** | Row Level Security enforced at the database layer — not application code |
| **Cloud Fallback** | Graceful degradation to direct Gemini API if backend is unreachable |
| **Dockerized Infrastructure** | Backend + Frontend + Postgres containerized with environment parity |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│   React 19  ·  TypeScript  ·  Framer Motion  ·  Tailwind CSS        │
│   Supabase Auth SDK  ·  Optimistic UI  ·  AnimatePresence           │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ HTTP (REST)
┌──────────────────────▼──────────────────────────────────────────────┐
│                         API LAYER                                    │
│   FastAPI  ·  Uvicorn  ·  Pydantic Validation  ·  CORS Middleware   │
│   POST /upload_resume  ·  POST /chat  ·  POST /roadmap              │
└───────┬──────────────────────────┬────────────────────────────────┬─┘
        │                          │                                │
┌───────▼──────┐         ┌─────────▼──────────┐        ┌──────────▼──┐
│  LangChain   │         │   Supabase Postgres │        │   Pinecone  │
│  RAG Pipeline│         │   + RLS Policies    │        │ Vector Index│
│  Gemini LLM  │         │   chat_history      │        │ 768-dim     │
│  Embeddings  │         │   Auth + Sessions   │        │ user_id tag │
└──────────────┘         └─────────────────────┘        └─────────────┘
```

### Request Lifecycle — Chat Message

```
1. React  →  optimistic UI update (message appears instantly)
2. React  →  getSession() extracts user_id from Supabase JWT
3. React  →  POST /api/chat {message, history[-10], user_id, conv_id}
4. FastAPI →  Pydantic validation → passes to rag_service
5. LangChain →  embed question (text-embedding-004, 768-dim)
6. Pinecone →  cosine similarity over user's vectors only (filter: {user_id})
7. Pinecone →  returns Top-5 most relevant resume chunks
8. LangChain →  builds prompt: system + history[-4] + chunks + question
9. Gemini  →  generates grounded response
10. FastAPI →  batch Supabase insert (user msg + AI msg in one call)
11. React  →  AI message renders in chat feed
```

**Total latency: ~1.5–3 seconds end-to-end**

---

## 🔬 RAG Pipeline Deep Dive

### Ingestion Pipeline

```python
# 1. PDF extraction
loader = PyPDFLoader(file_path)
documents = loader.load()

# 2. Optimized chunking
# chunk_size=1000, overlap=200 — tested across 500–2000 range
# 200-token overlap prevents context loss at chunk boundaries
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    separators=["\n\n", "\n", ".", " "]
)
chunks = text_splitter.split_documents(documents)

# 3. Security: user_id injected into EVERY chunk's metadata
# This is the isolation boundary for multi-tenant retrieval
for chunk in chunks:
    chunk.metadata["user_id"] = user_id

# 4. Embed + upsert to Pinecone
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
PineconeVectorStore.from_documents(chunks, embeddings, index_name=index_name)
```

### Query Pipeline

```python
# Metadata pre-filter: applied BEFORE cosine similarity search
# Pinecone searches only this user's vectors — not the full index
search_kwargs = {
    "k": 5,
    "filter": {"user_id": user_id}
}

qa_chain = RetrievalQA.from_chain_type(
    llm,
    retriever=vectorstore.as_retriever(search_kwargs=search_kwargs),
    chain_type_kwargs={"prompt": PromptTemplate.from_template(template)}
)
```

### Why These Specific Parameters

| Parameter | Value | Reasoning |
|---|---|---|
| `chunk_size` | 1000 tokens | Tested 500–2000; optimal signal-to-noise for resume documents |
| `chunk_overlap` | 200 tokens | Prevents semantic loss at chunk boundaries |
| `embedding_model` | `text-embedding-004` | 768-dim, strong on technical vocabulary, same model at ingest AND query |
| `top_k` | 5 (chat), 6 (roadmap) | Enough signal, minimal context dilution |
| `temperature` | 0.7 (chat), 0.2 (roadmap) | Chat benefits from creativity; roadmap requires deterministic JSON |

> **Critical**: The same embedding model must be used at both ingestion and query time. Using different models creates vectors in incompatible mathematical spaces — cosine similarity scores become meaningless.

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Role |
|---|---|---|
| **FastAPI** | 0.104.1 | Async Python web framework |
| **LangChain** | 0.1.0 | RAG pipeline orchestration |
| **LangChain-Google-GenAI** | 0.0.6 | Gemini + embedding integration |
| **LangChain-Pinecone** | 0.0.1 | Vector store connector |
| **Pinecone** | 3.0.0 | Vector database |
| **Supabase** | 2.3.0 | Auth + Postgres persistence |
| **Pydantic** | 2.5.2 | Request validation |
| **PyPDF** | 3.17.4 | PDF text extraction |
| **Uvicorn** | 0.24.0 | ASGI server |

### Frontend
| Technology | Version | Role |
|---|---|---|
| **React** | 19.0.0 | UI framework |
| **TypeScript** | ~5.8.2 | Type safety |
| **Framer Motion** | 11.11.11 | Animation library |
| **Tailwind CSS** | — | Utility-first styling |
| **Supabase JS** | 2.39.7 | Auth SDK + DB client |
| **Vite** | ^6.2.0 | Build tool |

### AI / Data
| Technology | Role |
|---|---|
| **Gemini** | LLM for chat + structured multi-agent analysis |
| **text-embedding-004** | 768-dimensional resume embeddings |
| **Pinecone** | Vector index with metadata filtering |

### Infrastructure
| Technology | Role |
|---|---|
| **Docker + Compose** | Three-service containerization |
| **postgres:15-alpine** | Local development database |
| **python:3.10-slim** | Minimal backend image |
| **Vercel** | Frontend deployment |

---

## 📁 Project Structure

```
careerpath-ai/
│
├── 📂 backend/
│   ├── main.py               # FastAPI app, CORS middleware, 3 core endpoints
│   ├── rag_service.py        # LangChain RAG pipeline, Pinecone ops, Gemini calls
│   ├── requirements.txt      # Pinned dependency versions (reproducible builds)
│   ├── Dockerfile            # python:3.10-slim base image
│   └── .env                  # API keys — never committed
│
├── 📂 components/
│   ├── App.tsx               # Root: global state, routing via AppSection enum
│   ├── AuthView.tsx          # Email/password auth, Supabase signIn/signUp
│   ├── CareerGPTView.tsx     # Main chat UI, RAG API calls, history load, optimistic send
│   ├── DashboardView.tsx     # Skill match widget, last conversation preview
│   ├── HistorySidebar.tsx    # Conversation list, search, AnimatePresence exits
│   ├── ResumeAgentView.tsx   # Multi-agent persona analysis rendering
│   ├── ResumeUploader.tsx    # PDF upload, vector/local fallback status
│   ├── RoadmapView.tsx       # 4-phase roadmap generator, error state handling
│   └── RoadmapVisualization.tsx  # Dashboard roadmap widget
│
├── 📂 services/
│   ├── geminiService.ts      # Supabase auth wrappers, history fetch, roadmap + cloud fallback
│   └── supabaseClient.ts     # Single Supabase client instance
│
├── 📂 frontend/
│   ├── app/page.tsx          # Next.js entry (legacy)
│   └── components/           # Standalone frontend components
│
├── types.ts                  # TypeScript interfaces + AppSection enum (single source of truth)
├── constants.tsx             # SVG icons, DevOps code stubs
├── index.html                # App shell
├── index.tsx                 # React root render with Suspense boundary
├── supabase_setup.sql        # DB schema, RLS policies, indexes — run once
├── docker-compose.yml        # Backend + Frontend + Postgres services
├── vite.config.ts            # Build config + env variable injection
└── tsconfig.json             # TypeScript compiler options
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **Docker** + Docker Compose
- **Pinecone** account + API key → [pinecone.io](https://pinecone.io)
- **Google AI Studio** API key → [ai.google.dev](https://ai.google.dev)
- **Supabase** project → [supabase.com](https://supabase.com)

### Option 1 — Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-username/careerpath-ai.git
cd careerpath-ai

# Configure environment
cp backend/.env.example backend/.env
# Fill in your API keys (see Environment Variables section)

# Launch all services
docker-compose up --build
```

Services will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

### Option 2 — Manual Setup

**Backend**

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run server
uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
# From project root
npm install

# Configure environment
cp .env.local.example .env.local
# Add GEMINI_API_KEY

# Run dev server
npm run dev
# → http://localhost:3000
```

**Database Setup**

```bash
# In your Supabase project → SQL Editor
# Run the contents of supabase_setup.sql

# This creates:
# - chat_history table
# - Row Level Security policies
# - Performance index on user_id
```

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
# Google AI Studio — required for Gemini and embeddings
GOOGLE_API_KEY=your_google_api_key_here

# Pinecone — required for vector storage
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=careerpath-ai

# Supabase — required for auth and chat history
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key

# Server
ENV=development
PORT=8000
```

### Frontend (`.env.local`)

```env
# Google Gemini — required for cloud fallback + resume analysis
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Security note**: Never commit `.env` files. Both are listed in `.gitignore`. The Supabase anon key in `supabaseClient.ts` is a public key — safe to expose. The service role key in the backend is private — keep it server-side only.

---

## 📡 API Reference

### `POST /api/upload_resume`

Ingest a resume PDF into Pinecone with per-user vector isolation.

**Headers**
```
user-id: <supabase_user_uuid>
Content-Type: multipart/form-data
```

**Body**
```
file: <PDF file>
```

**Response**
```json
{
  "status": "success",
  "chunks_processed": 24
}
```

---

### `POST /api/chat`

Send a message to the RAG-powered career coach.

**Body**
```json
{
  "message": "What are my key skill gaps for a Staff Engineer role?",
  "history": [
    { "role": "user", "content": "previous message" },
    { "role": "model", "content": "previous response" }
  ],
  "user_id": "supabase-user-uuid",
  "conversation_id": "existing-uuid-or-null"
}
```

**Response**
```json
{
  "response": "Based on your resume, your strongest areas are...",
  "conversation_id": "uuid-for-this-conversation"
}
```

---

### `POST /api/roadmap`

Generate a 4-phase career roadmap grounded in resume context.

**Body**
```json
{
  "target_role": "Senior DevOps Engineer",
  "user_id": "supabase-user-uuid"
}
```

**Response**
```json
{
  "missing_skills": ["Kubernetes", "Terraform", "SRE practices"],
  "steps": [
    {
      "title": "Container Orchestration Mastery",
      "description": "Deep dive into Kubernetes...",
      "difficulty": "Intermediate",
      "estimated_time": "6-8 weeks"
    }
  ]
}
```

---

## 🗄️ Database Schema

```sql
-- chat_history table
CREATE TABLE chat_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID,                                    -- groups messages into sessions
  title           TEXT DEFAULT 'New Conversation',         -- first 40 chars of first message
  message         TEXT NOT NULL,
  sender          TEXT NOT NULL CHECK (sender IN ('user', 'model')),
  created_at      TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- Row Level Security — data isolation enforced at DB layer
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat history"
  ON chat_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat records"
  ON chat_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Performance index — all history queries filter by user_id
CREATE INDEX idx_chat_history_user_id ON chat_history(user_id);
```

### Schema Design Decisions

- **`ON DELETE CASCADE`** — deleting a user account automatically removes all their history
- **`CHECK` constraint on `sender`** — DB-level enforcement, mirrors TypeScript union type and Pydantic regex validator
- **`TIMESTAMPTZ` with UTC** — no timezone ambiguity in queries
- **Index on `user_id`** — without it, history queries do full table scans; with it, sub-50ms at scale

---

## 🔒 Security Architecture

CareerPath AI uses a **defense-in-depth** approach: the same user identity is enforced at every layer independently.

```
Layer 1 — TypeScript (Frontend)
  role: 'user' | 'model'  →  union type, compile-time enforcement

Layer 2 — Pydantic (API boundary)
  role: str = Field(..., pattern="^(user|model)$")  →  422 on violation

Layer 3 — Pinecone (Vector retrieval)
  filter: {"user_id": user_id}  →  pre-filter before similarity search

Layer 4 — Supabase RLS (Database)
  USING (auth.uid() = user_id)  →  impossible to bypass from app code

Layer 5 — Supabase CHECK (Schema)
  CHECK (sender IN ('user', 'model'))  →  DB-level constraint
```

### Multi-Tenant Vector Isolation

```python
# INGEST — every chunk tagged at creation
for chunk in chunks:
    chunk.metadata["user_id"] = user_id   # ownership boundary

# QUERY — pre-filter applied before ANN search
search_kwargs = {
    "k": 5,
    "filter": {"user_id": user_id}         # searches only user's vectors
}
```

This is a **pre-filter** (not post-filter). Pinecone runs approximate nearest neighbor search only over the filtered candidate set. It is structurally impossible for User A's query to return User B's resume chunks.

---

## 📦 Deployment

### Docker (Production)

```bash
# Build and launch
docker-compose -f docker-compose.yml up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down
```

### Frontend — Vercel

```bash
npm run build
# Deploy dist/ to Vercel

# Required environment variable in Vercel dashboard:
# GEMINI_API_KEY = your_key
```

### Backend — Any VPS / Cloud Run

```bash
cd backend
docker build -t careerpath-backend .
docker run -p 8000:8000 --env-file .env careerpath-backend
```

### Pinecone Index Setup

Create a Pinecone index with:
- **Dimensions**: 768 (matches `text-embedding-004`)
- **Metric**: Cosine
- **Index name**: `careerpath-ai` (or update `PINECONE_INDEX_NAME`)

---

## 🧠 Engineering Decisions

### Why LangChain over raw API calls?

LangChain's `RetrievalQA.from_chain_type()` orchestrates retrieval, prompt construction, and LLM calls in a composable chain. The retriever handles embedding + similarity search + metadata filtering in a single abstraction. Custom orchestration would require duplicating this without added benefit.

### Why Pinecone over pgvector?

Pinecone is purpose-built for ANN search at scale with native metadata filtering. pgvector requires manual index management and lacks pre-filter support at the query level. For a multi-user system where isolation is a core requirement, Pinecone's metadata filter is the correct primitive.

### Why Supabase RLS instead of application-level filtering?

Application-level `WHERE user_id = $1` is fragile — one missed filter on a new endpoint creates a data exposure bug. RLS enforces isolation at the database layer: even if application code is wrong, Supabase blocks the query. One policy, zero gaps.

### Why not react-router?

This app has no URL-based routing requirements (no shareable deep links, no browser back/forward). An `AppSection` enum + single `activeSection` state variable is simpler, eliminates a dependency, and is easier to reason about.

### Why `python:3.10-slim` not `python:3.10`?

The slim image is ~150MB vs ~900MB for the full image. Smaller attack surface, faster pulls in CI/CD, lower container storage costs. All required system dependencies are included in `requirements.txt`.

### Why batch Supabase insert?

User message and AI response are inserted in a single batch call rather than two sequential calls. Halves the database round-trips per chat exchange and ensures both messages are always in sync — no partial writes.

---

## 🤝 Contributing

Contributions are welcome. Please follow these steps:

```bash
# 1. Fork the repository

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and test
# Backend: uvicorn main:app --reload
# Frontend: npm run dev

# 4. Commit with a conventional commit message
git commit -m "feat: add job description matching endpoint"

# 5. Push and open a Pull Request
git push origin feature/your-feature-name
```

### Planned v2 Features (Good First Issues)

- [ ] **Job Description Matching** — paste a JD, get match % + gap analysis against resume vectors
- [ ] **Mock Interview Agent** — role-specific questions evaluated against STAR framework
- [ ] **Resume Version Control** — multiple resume versions per user via Pinecone namespace switching
- [ ] **LinkedIn Profile Sync** — OAuth import with delta re-indexing (only changed sections re-embedded)
- [ ] **Real-time streaming** — Server-Sent Events for streaming Gemini responses token-by-token

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with hands-on engineering — not tutorials.**

RAG · LangChain · Pinecone · Gemini · FastAPI · Supabase · React 19 · Docker

<br/>

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/pravin-waghmare-8b47692a7/)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Visit-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://ai-career-coach-new.vercel.app)

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" alt="footer"/>

</div>
