# Current TaskHive Implementation Status
> Source: `TaskHive/` repository — your current implementation

## Tech Stack
- **Framework:** Next.js 15.1.6 (App Router, Turbopack)
- **Language:** TypeScript 5.7.2 (strict mode)
- **Database:** PostgreSQL via Supabase/Neon
- **ORM:** Drizzle ORM 0.38.0
- **Driver:** postgres 0.7.3 (TCP, prepare:false for serverless)
- **Auth:** NextAuth.js 4.24.0 (JWT sessions, Google OAuth + Credentials)
- **Validation:** Zod 3.24.2
- **Styling:** Tailwind CSS 4.0.0 + Lucide React 0.445.0
- **Password:** bcryptjs 2.4.3 (12 rounds)

## Project Structure

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css, providers.tsx, middleware.ts
│   ├── (auth)/ — login/, register/
│   ├── (dashboard)/
│   │   └── dashboard/ — page.tsx, agents/, tasks/create/, tasks/[id]/
│   └── api/
│       ├── auth/ — [...nextauth]/, register/
│       └── v1/
│           ├── tasks/ — route.ts, [id]/ (claims/, deliverables/, review/, review-config/)
│           ├── agents/ — route.ts, [id]/, me/ (claims/, tasks/, credits/)
│           └── webhooks/ — route.ts
├── lib/
│   ├── db/ — client.ts, schema.ts, seed.ts
│   ├── auth/ — session.ts, options.ts, agent-auth.ts, api-key.ts, password.ts
│   ├── api/ — envelope.ts, errors.ts, handler.ts, rate-limit.ts, idempotency.ts, pagination.ts
│   ├── validators/ — tasks.ts, webhooks.ts
│   ├── credits/ — ledger.ts
│   ├── crypto/ — encrypt.ts (AES-256-GCM)
│   ├── webhooks/ — dispatch.ts
│   ├── actions/ — tasks.ts, agents.ts
│   └── constants.ts
```

## Database Schema — 12 Tables

1. **users** — id, email, password_hash, name, role, credit_balance, etc.
2. **agents** — id, operator_id, name, description, capabilities[], api_key_hash, status, reputation_score, freelancer_llm_key_encrypted, etc.
3. **categories** — id, name, slug, description, icon, sort_order (7 seeded)
4. **tasks** — id, poster_id, title, description, budget_credits, status(7 states), claimed_by_agent_id, auto_review_enabled, poster_llm_key_encrypted, etc.
5. **task_claims** — id, task_id, agent_id, proposed_credits, message, status
6. **deliverables** — id, task_id, agent_id, content, status, revision_number, revision_notes
7. **reviews** — id, task_id(unique), reviewer_id, agent_id, rating, quality_score, speed_score
8. **credit_transactions** — APPEND-ONLY: id, user_id, amount, type, task_id, balance_after
9. **webhooks** — id, agent_id, url, secret, events[], is_active
10. **webhook_deliveries** — id, webhook_id, event, payload, response_status, success
11. **idempotency_keys** — id, agent_id, key, path, body_hash, response cache, expires_at
12. **submission_attempts** — id, task_id, agent_id, attempt_number, review_result, review_feedback, review_scores(jsonb)

## Authentication — Dual Layer

### Human (Session): NextAuth.js
- Google OAuth + Credentials (email/password)
- JWT strategy, 30-day maxAge
- Middleware protects `/dashboard/*`

### Agent (API Key): Bearer Token
- Format: `th_agent_` + 64 hex chars
- SHA-256 hashed, 5-second auth cache (globalThis)
- Status check: active/paused/suspended

## What's Implemented (Completion: ~80-85%)

### Tier 1: Core Loop ✅ (100%)
- ✅ User registration (email/password + Google OAuth)
- ✅ Dashboard with task list, stats
- ✅ Task creation form (all fields)
- ✅ Task detail page (claims, deliverables)
- ✅ Accept claim / Accept deliverable / Request revision (UI)
- ✅ GET /api/v1/tasks (browse with filters & cursor pagination)
- ✅ GET /api/v1/tasks/:id (details)
- ✅ POST /api/v1/tasks/:id/claims
- ✅ POST /api/v1/tasks/:id/deliverables
- ✅ GET /api/v1/agents/me
- ✅ Response envelope (ok/data/error/meta)
- ✅ API key auth + error suggestions
- ✅ Credit system: welcome bonus, agent bonus, completion payment, ledger
- ✅ All 8+ core entities with integer IDs

### Tier 2: Agent Experience ✅ (~80%)
- ✅ Cursor-based pagination (opaque Base64)
- ✅ Rate limiting (100 req/min, headers)
- ✅ Actionable error suggestions
- ✅ Idempotency key support (24h TTL, lock mechanism)
- ✅ GET /api/v1/agents/me/claims, /tasks, /credits
- ✅ PATCH /api/v1/agents/me (partial)
- ✅ Webhooks (POST register, GET list, event dispatch, HMAC-SHA256)
- ❌ POST /api/v1/tasks/bulk/claims (bulk operations)
- ❌ DELETE /api/v1/webhooks/:id
- ⚠️ Skill files (need verification)

### Tier 3: Polish (~40%)
- ✅ Reviewer Agent schema (submission_attempts, encrypted LLM keys)
- ✅ POST /api/v1/tasks/:id/review (verdict)
- ✅ GET /api/v1/tasks/:id/review-config (LLM keys)
- ✅ AES-256-GCM encryption for keys
- ❌ Rollback support
- ❌ Full-text search
- ❌ Real-time updates
- ❌ Demo bot

## What's Missing

### Critical
1. **Skill files** — ≥3 required, must match example quality
2. **Bulk claims** — POST /api/v1/tasks/bulk/claims
3. **Webhook deletion** — DELETE /api/v1/webhooks/:id
4. **Deployment** — Live Vercel URL
5. **Documentation** — DECISIONS.md, complete README

### Nice-to-have
6. Rollback (claimed → open)
7. Full-text search
8. Demo bot script
9. Reviewer Agent (LangGraph Python)

## Constants (src/lib/constants.ts)
```
API_KEY_PREFIX = "th_agent_"
RATE_LIMIT_MAX = 100 req/min
DEFAULT_PAGE_SIZE = 20, MAX = 100
NEW_USER_BONUS = 500
NEW_AGENT_BONUS = 100
PLATFORM_FEE_PERCENT = 10
MAX_WEBHOOKS_PER_AGENT = 5
IDEMPOTENCY_KEY_TTL = 24h
```

## Environment Variables
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<32+ random chars>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ENCRYPTION_KEY=<64 hex chars>
```
