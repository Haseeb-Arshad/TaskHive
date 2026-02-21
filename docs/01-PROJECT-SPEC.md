# TaskHive Project Specification
> Source: `taskhive-hiring-test` repository (complete spec documentation)

## What Is TaskHive?

An **AI-agent-first freelancer marketplace** using the **Trinity Architecture** (Skill files + REST API + Implementation). Humans post tasks via UI, AI agents discover/claim/deliver work via API, earning reputation credits.

## Trinity Architecture

Three synchronized layers that MUST stay in sync (the "Binding Rule"):

### Layer 1: Skill Files (Top)
- Micro-verbose instruction documents, one per endpoint
- Contains: tool, purpose, auth, parameters, response shape, error codes with `suggestion` field, latency target, rate limit, examples
- Stored in `skills/` directory, version-controlled alongside code

### Layer 2: Tools Layer (Middle) — REST API
- Consistent response envelope: `{ ok, data/error, meta }`
- Actionable error messages with `suggestion` field
- **Integer IDs** (not UUIDs) for agent-friendliness
- Cursor-based pagination (opaque Base64)
- Bulk operations with partial success
- Idempotency support via `Idempotency-Key` header
- Rate limiting: 100 req/min per API key with headers

### Layer 3: Software Layer (Bottom) — Implementation
- Database, business logic, state machines, auth middleware
- Full architectural freedom for candidates

## Core Loop (5-Step Lifecycle)

```
POST TASK → AGENT BROWSES → AGENT CLAIMS → AGENT DELIVERS → POSTER ACCEPTS
(Human/Agent)  (API)          (API)          (API)           (UI/API)
```

### Task State Machine
```
OPEN → CLAIMED → IN_PROGRESS → DELIVERED → COMPLETED
  ↓       ↓          ↓            ↓
CANCELLED  CANCELLED  CANCELLED   DISPUTED → COMPLETED/CANCELLED
```

## Data Model (9 Entities)

1. **Users** - id, email, name, role(poster/operator/both/admin), credit_balance
2. **Agents** - id, operator_id→User, name, description, capabilities[], api_key_hash, status(active/paused/suspended), reputation_score(0-100), tasks_completed, avg_rating
3. **Tasks** - id, poster_id→User, title, description, budget_credits(min 10), category_id, status, claimed_by_agent_id, deadline, max_revisions(default 2)
4. **TaskClaims** - id, task_id, agent_id, proposed_credits(≤budget), message, status(pending/accepted/rejected/withdrawn)
5. **Deliverables** - id, task_id, agent_id, content(1-50000 chars), status(submitted/accepted/rejected/revision_requested), revision_number, revision_notes
6. **Reviews** - id, task_id(unique), reviewer_id, agent_id, rating(1-5), quality_score, speed_score, comment
7. **CreditTransactions** - id, user_id, amount, type(deposit/bonus/payment/platform_fee/refund), task_id, balance_after — APPEND-ONLY
8. **Categories** - id, name, slug, description, icon, sort_order — Seed: Coding, Writing, Research, Data Processing, Design, Translation, General
9. **Webhooks** - id, agent_id, url, secret, events[], is_active, failure_count

## Authentication

### Human: Session-based (email+password)
- NextAuth.js recommended, JWT sessions
- Protected routes: `/dashboard/*`

### Agent: API Key Bearer Token
- Format: `th_agent_` + 64 hex chars (72 total)
- SHA-256 hashed, never stored raw
- Prefix stored for display (`th_agent_a1b2…`)
- Rate limit: 100 req/min per key

## Credit System (Promise Model — No Escrow)

**Constants:**
- NEW_USER_BONUS = 500 credits
- NEW_AGENT_BONUS = 100 credits
- MIN_TASK_BUDGET = 10 credits
- PLATFORM_FEE = 10%

**Flow:**
1. User registers → 500 welcome credits
2. Agent registered → +100 to operator
3. Task completed → operator gets `budget - floor(budget * 0.10)`
4. Append-only ledger with `balance_after` snapshot

## API Endpoints

### Tier 1 (Required — 60% of points):
1. `POST /api/v1/tasks` — Create task
2. `GET /api/v1/tasks` — Browse with filters/pagination
3. `GET /api/v1/tasks/:id` — Task details
4. `POST /api/v1/tasks/:id/claims` — Claim task
5. `POST /api/v1/tasks/:id/deliverables` — Submit work
6. `POST /api/v1/tasks/:id/claims/:claimId/accept` — Accept claim
7. `POST /api/v1/tasks/:id/deliverables/:delId/accept` — Accept deliverable
8. `POST /api/v1/tasks/:id/deliverables/:delId/revision` — Request revision
9. `GET /api/v1/agents/me` — Agent profile

### Tier 2 (25%):
- Skill files (≥3), bulk claims, error quality, cursor pagination, rate limiting, agent profile endpoints, idempotency

### Tier 3 (15%):
- Webhooks, rollback, search, agent visibility, real-time, demo bot, reviews

### Bonus (+10):
- Reviewer Agent (LangGraph, auto-evaluates deliverables, PASS/FAIL, dual key support)

## Response Envelope

```json
// Success
{ "ok": true, "data": {...}, "meta": { "timestamp", "request_id", "cursor?", "has_more?", "count?" } }

// Error
{ "ok": false, "error": { "code", "message", "suggestion" }, "meta": { "timestamp", "request_id" } }
```

## Evaluation Criteria (100 pts + 20 bonus)

| Category | Weight |
|----------|--------|
| Core Loop Works | 30% |
| Agent API Quality | 25% |
| Trinity Architecture | 20% |
| Code Quality | 15% |
| Documentation | 10% |

**Instant DQ:** Broken deployment, no live URL, plagiarism, no core loop, no Skill files, no API key auth, deception
