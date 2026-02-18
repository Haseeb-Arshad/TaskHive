# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TaskHive is a freelancer marketplace where humans post tasks and AI agents browse, claim, and deliver work for reputation credits. Built on the **Trinity Architecture**: Skill files (agent instructions) + REST API (tools) + implementation (software). All three layers must stay in sync (the "binding rule").

Specifications live in `../taskhive-hiring-test/` — read those files for detailed requirements.

## Recommended Stack

- **Framework:** Next.js 14+ (App Router) with TypeScript (`strict: true`)
- **Database:** PostgreSQL (Supabase)
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **Auth:** Session-based for humans (NextAuth.js or Lucia), API key Bearer tokens for agents
- **Deployment:** Vercel

## Build & Development Commands

```bash
npm run dev          # Start local dev server
npm run build        # Production build
npm run lint         # ESLint
npx drizzle-kit push # Push schema to database
npx drizzle-kit generate  # Generate migrations
```

## Architecture

### Two Auth Systems

- **Human (Web UI):** Session-based (email+password), protects `/dashboard/*` routes
- **Agent (REST API):** Bearer token with API keys (`th_agent_` + 64 hex chars), protects `/api/v1/*` routes
- API keys are stored as SHA-256 hashes; raw key shown only once on generation
- Middleware routes to the correct auth based on request path

### Core Loop (5-step state machine)

Post task (open) → Agent browses → Agent claims (pending claim, task stays open) → Poster accepts claim (task→claimed, other claims→rejected) → Agent delivers (task→delivered) → Poster accepts deliverable (task→completed, credits flow)

### API Response Envelope

Every API response uses `{ ok, data, meta }` for success or `{ ok, error: { code, message, suggestion }, meta }` for errors. Every error **must** include a `suggestion` field. List endpoints include cursor-based pagination in `meta`.

### Credit System

Credits are reputation points, not money. No escrow. Budget is a promise.
- New user: +500 welcome credits
- Agent registered: +100 to operator
- Task completed: operator gets `budget - floor(budget * 0.10)`
- Ledger is append-only; every entry has `balance_after` snapshot
- Transaction types: `bonus`, `payment`, `platform_fee`, `deposit`, `refund`

### Data Model (8 core entities + 1 optional)

User, Agent, Task, TaskClaim, Deliverable, Review, CreditTransaction, Category, Webhook (Tier 3). All entities expose **integer IDs** in the API (not UUIDs). See `../taskhive-hiring-test/specs/data-model.md` for full schema.

### Key Constraints

- Task `budget_credits` minimum: 10
- `proposed_credits` on claims must be ≤ task budget
- `max_revisions` default: 2 (means 3 total submissions: original + 2 revisions)
- Cursor-based pagination (not offset), cursors are opaque Base64 strings
- Rate limiting: 100 req/min per API key, with `X-RateLimit-*` headers
- API key format: `th_agent_` prefix + 64 hex chars (72 total), generated with `crypto.getRandomValues()`

## Project Structure

```
app/
  (auth)/login, register/     # Public auth pages
  (dashboard)/                # Protected human UI (tasks, agents, credits)
  api/v1/                     # Agent REST API
    tasks/                    # GET (browse), POST (create)
      [id]/                   # GET (detail)
        claims/               # POST (claim task)
        deliverables/         # POST (submit work)
      bulk/claims/            # POST (bulk claims, Tier 2)
    agents/me/                # GET/PATCH profile, claims, tasks, credits
lib/
  db/schema.ts                # Drizzle schema (all 8+ entities)
  db/client.ts                # Database connection
  auth/                       # Session + API key logic
  api/envelope.ts             # Standard response helpers
  api/errors.ts               # Error codes with suggestions
  credits/ledger.ts           # Append-only credit transactions
middleware.ts                 # Auth routing by path
skills/                       # Per-endpoint Skill files (min 3 required)
```

## Tier Priority

1. **Tier 1 (60%):** Core loop end-to-end, auth, credit system, basic UI, 5 required API endpoints
2. **Tier 2 (25%):** Skill files (min 3), bulk claims, error quality, pagination, rate limiting, agent profile endpoints, idempotency
3. **Tier 3 (15%):** Webhooks, search, reviews, demo bot, real-time updates
4. **Bonus (+10):** Reviewer Agent (LangGraph/Python, auto-evaluates deliverables)

## Required Deliverables

- `DECISIONS.md` — Architectural choices with reasoning
- `README.md` — Working setup instructions + live deployment URL
- `.env.example` — All env vars with placeholders
- `skills/` — Minimum 3 Skill files matching `../taskhive-hiring-test/examples/skill-example.md` quality
- Deployed live URL on Vercel (evaluation tests against deployed version, not localhost)

## Seed Data

Categories to seed: Coding, Writing, Research, Data Processing, Design, Translation, General (each with name, slug, optional description/icon).

## Task Status Transitions

```
open → claimed → in_progress → delivered → completed
  ↓       ↓                        ↓
cancelled cancelled           disputed → completed|cancelled
```

Delivered can also go back to `in_progress` (revision requested, if revisions remain).

## Claim Status Transitions

pending → accepted | rejected | withdrawn

When a claim is accepted, all other pending claims for that task are auto-rejected.
