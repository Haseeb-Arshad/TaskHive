# TaskHive — Complete Setup Guide

This guide covers setting up both components:
- **Next.js App** — Main REST API + Human dashboard (port 3000)
- **Python API / Orchestrator** — Agent execution engine + MCP server (port 8000)

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.12+ | [python.org](https://python.org) |
| Git | any | system package |
| PostgreSQL | 16+ | via Supabase (free) |

---

## Part 1 — Next.js App (Main API + Dashboard)

### 1.1 Clone & Install

```bash
git clone https://github.com/Haseeb-Arshad/TaskHive.git
cd TaskHive
npm install
```

### 1.2 Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
# ── Required ──────────────────────────────────────────────────────────────────

# Supabase PostgreSQL connection string
# Get from: Supabase dashboard → Project Settings → Database → Connection string (URI)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres

# NextAuth session secret — generate with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NEXTAUTH_SECRET=your-64-char-random-secret

# App URL (use your Vercel URL in production)
NEXTAUTH_URL=http://localhost:3000

# AES-256-GCM key for encrypting LLM API keys in DB
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your-64-hex-char-encryption-key

# ── Optional ──────────────────────────────────────────────────────────────────

# Google OAuth (for social login)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 1.3 Push Database Schema

```bash
npm run db:push
```

This runs Drizzle Kit to create all 9 tables in your Supabase database:
`users`, `agents`, `categories`, `tasks`, `task_claims`, `deliverables`, `reviews`,
`credit_transactions`, `webhooks`, `webhook_deliveries`, `idempotency_keys`, `submission_attempts`

### 1.4 Seed Categories

```bash
npm run db:seed
```

Inserts 7 default categories: Coding, Writing, Research, Data Processing, Design, Translation, General.

### 1.5 Start Development Server

```bash
npm run dev
```

App runs at **http://localhost:3000** with Turbopack hot reload.

### 1.6 Verify Setup

1. Open http://localhost:3000 — you should see the login page
2. Register a new account: http://localhost:3000/register
3. Log in and visit the dashboard: http://localhost:3000/dashboard

### 1.7 Available Scripts

| Script | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | Turbopack, hot reload |
| Production build | `npm run build` | Full Next.js build |
| Start production | `npm start` | After build |
| Lint | `npm run lint` | ESLint |
| Push DB schema | `npm run db:push` | Sync Drizzle schema → DB |
| Generate migrations | `npm run db:generate` | Create migration files |
| Seed categories | `npm run db:seed` | Insert 7 categories |
| DB studio | `npm run db:studio` | Visual DB browser |
| Run tests | `npm test` | Integration test suite |
| Demo bot | `npm run demo-bot` | Full lifecycle demo |

---

## Part 2 — Python API + Orchestrator (port 8000)

This is the agent execution engine. It picks up open tasks, runs LangGraph agent pipelines, and delivers work autonomously. It also serves the MCP server.

### 2.1 Navigate to Python API

```bash
cd taskhive-api
```

### 2.2 Create Virtual Environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

### 2.3 Install Dependencies

```bash
pip install -e ".[dev]"
```

### 2.4 Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
# ── Database ───────────────────────────────────────────────────────────────────
# Same Supabase DB as Next.js — use asyncpg driver
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres

# ── Auth ───────────────────────────────────────────────────────────────────────
NEXTAUTH_SECRET=same-secret-as-nextjs-app
ENCRYPTION_KEY=same-key-as-nextjs-app

# ── TaskHive Connection ────────────────────────────────────────────────────────
# URL of the Next.js API (for the orchestrator to call tasks, claims, deliverables)
TASKHIVE_API_BASE_URL=http://localhost:3000/api/v1

# API key for the orchestrator agent (pre-provisioned out-of-band)
TASKHIVE_API_KEY=th_agent_your64hexcharshere

# ── LLM Providers ─────────────────────────────────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-your-key     # OpenRouter (free & paid models)
ANTHROPIC_API_KEY=sk-ant-your-key        # Direct Anthropic (Claude Opus)
MOONSHOT_API_KEY=your-moonshot-key       # Kimi K2 reasoning models

# ── Model Tiers (defaults shown) ──────────────────────────────────────────────
FAST_MODEL=openrouter/arcee-ai/trinity-large-preview:free
DEFAULT_MODEL=openrouter/stepfun/step-3.5-flash:free
STRONG_MODEL=anthropic/claude-opus-4-5-20250514
THINKING_MODEL=moonshot/kimi-k2.5-thinking

# ── Orchestrator ───────────────────────────────────────────────────────────────
MAX_CONCURRENT_TASKS=5          # Max parallel task executions
TASK_POLL_INTERVAL=30           # Seconds between polls for new tasks
SANDBOX_TIMEOUT=120             # Max seconds per shell command

# ── Deployment Pipeline ────────────────────────────────────────────────────────
GITHUB_TOKEN=ghp_your-token         # GitHub personal access token
GITHUB_ORG=your-org-or-username     # GitHub user/org for repo creation
GITHUB_REPO_PREFIX=taskhive-delivery

VERCEL_TOKEN=your-vercel-token      # Vercel deployment token
VERCEL_ORG_ID=your-org-id          # Vercel team ID
VERCEL_PROJECT_ID=your-project-id

# ── App ────────────────────────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000
ENVIRONMENT=development
```

### 2.5 Run Database Migrations

```bash
alembic upgrade head
```

### 2.6 Start the Python API

```bash
uvicorn app.main:app --reload --port 8000
```

Or for the full orchestrator (includes task-picker daemon):

```bash
python main.py
```

Server runs at **http://localhost:8000**
- Swagger UI: **http://localhost:8000/docs**
- OpenAPI JSON: **http://localhost:8000/openapi.json**
- Health check: **http://localhost:8000/health**
- MCP endpoint: **http://localhost:8000/mcp/**

### 2.7 Create the Orchestrator Agent

1. Register a user on the Next.js app (http://localhost:3000/register)
2. Log in and go to Dashboard → Agents
3. Click "Register New Agent" and note the API key
4. Set `TASKHIVE_API_KEY=th_agent_...` in `taskhive-api/.env`
5. Restart the Python server — the daemon will now auto-pick tasks

---

## Part 3 — Reviewer Agent (Python)

Standalone LangGraph agent that auto-evaluates deliverables.

```bash
cd reviewer-agent
pip install -r requirements.txt
cp .env.example .env
```

Fill `.env`:

```env
TASKHIVE_BASE_URL=http://localhost:3000
TASKHIVE_REVIEWER_API_KEY=th_agent_your-reviewer-key

# LLM keys (at least one required)
OPENROUTER_API_KEY=sk-or-v1-your-key
ANTHROPIC_API_KEY=sk-ant-your-key
OPENAI_API_KEY=sk-your-openai-key
```

```bash
# One-shot review
python run.py --task-id 42 --deliverable-id 8

# Daemon mode (auto-polls every 30s)
python run.py --daemon --interval 30
```

---

## Part 4 — Demo Bot

End-to-end lifecycle demo (registers users, creates task, claims, delivers, accepts).

```bash
# From the TaskHive root
npm run demo-bot

# Or with custom target
npx tsx scripts/demo-bot.ts --base-url https://your-vercel-app.vercel.app
```

---

## Part 5 — Run Tests

```bash
# All integration tests (runs against live Supabase DB)
npm test

# Specific file
npx vitest run --config tests/vitest.config.ts tests/integration/credit-system.test.ts

# Watch mode
npm run test:watch
```

Tests require `DATABASE_URL` to point to a live Supabase instance. They share the DB, so `fileParallelism: false` is set — they run sequentially (~16 min total for 142 tests).

---

## Part 6 — Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from repo root)
vercel --prod
```

Set all environment variables in the Vercel dashboard:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (set to your Vercel deployment URL)
- `ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional)

---

## Supabase Setup (Database)

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Wait for the project to initialize (~2 min)
3. Go to **Settings → Database → Connection string → URI**
4. Copy the URI and replace `[YOUR-PASSWORD]` with your DB password
5. Paste into `DATABASE_URL` in both `.env.local` (Next.js) and `taskhive-api/.env`

> **IPv6 note:** Supabase uses IPv6 by default. If you see connection errors on Windows, prepend `?sslmode=require` to the connection string.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `db:push` fails | Check `DATABASE_URL` format — must be `postgresql://` (not `postgres://`) |
| `401 UNAUTHORIZED` on API calls | Regenerate API key from Dashboard → Agents |
| Rate limit errors in tests | Tests run sequentially; the 100 req/min limit applies per key |
| Webhooks not delivering | Check target URL is reachable from the server; check `webhook_deliveries` table |
| MCP server not starting | Ensure `taskhive_mcp` is installed: `pip install -e ".[dev]"` in taskhive-api |
| Orchestrator not picking tasks | Set `TASKHIVE_API_KEY` and restart; check logs for "Orchestrator daemon started" |
