# Implementation Roadmap — Bringing It All Together
> Synthesizing patterns from automaton + agentswarm into TaskHive

## Current Status: ~80-85% Complete

The core loop works end-to-end. What's needed now is **polish, missing endpoints, and advanced patterns**.

---

## Phase 1: Critical Missing Features (Priority: HIGH)

### 1.1 Skill Files (≥3 required, worth 20% of score)
Create `skills/` directory with at minimum:
- `skills/browse-tasks.md` — GET /api/v1/tasks
- `skills/claim-task.md` — POST /api/v1/tasks/:id/claims
- `skills/submit-deliverable.md` — POST /api/v1/tasks/:id/deliverables

Each must include: tool, purpose, auth, parameters table, response shape, error codes with suggestions, latency target, rate limit, full example request/response.

### 1.2 Bulk Claims Endpoint
```
POST /api/v1/tasks/bulk/claims
Body: { claims: [{ task_id, proposed_credits, message? }] } (max 10)
Response: { results: [{ task_id, ok, claim_id?, error? }], summary: { succeeded, failed, total } }
```
- Validate each claim independently
- Partial success expected

### 1.3 Webhook Deletion
```
DELETE /api/v1/webhooks/:id
- Verify webhook belongs to authenticated agent
- Return 204 No Content on success
```

### 1.4 DECISIONS.md
Document architectural choices:
- Why Next.js 15 + App Router
- Why Drizzle over Prisma
- Why PostgreSQL
- Why JWT sessions over database sessions
- Why cursor pagination over offset
- Integer ID strategy (serial PKs)
- API key format rationale
- Credit system design (promise model)

### 1.5 Complete README.md
- Project description
- Live deployment URL
- Local setup instructions
- Environment variables
- Database setup (`npm run db:push && npm run db:seed`)
- Running locally (`npm run dev`)
- API key generation walkthrough

---

## Phase 2: Patterns from Automaton (Priority: MEDIUM)

### 2.1 Explicit State Machine Transitions
**From:** Ad-hoc status checks scattered in handlers
**To:** Centralized transition map

```typescript
// src/lib/state-machine.ts
const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ['claimed', 'cancelled'],
  claimed: ['in_progress', 'cancelled'],
  in_progress: ['delivered'],
  delivered: ['completed', 'in_progress', 'disputed'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

export function validateTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TASK_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### 2.2 Constitution File
Create `CONSTITUTION.md` codifying immutable rules:
- Credits = reputation, not currency
- Budget = promise, never escrowed
- Append-only ledger
- SHA-256 hashed API keys
- 100 req/min rate limit
- Standard envelope on all responses
- Integer IDs for agents
- Error suggestions always present

### 2.3 Testing with Vitest
Add tests for critical paths:
- State machine transitions (all valid + invalid)
- Credit calculations (welcome bonus, agent bonus, completion payment)
- API key generation + validation
- Rate limiter behavior
- Cursor encoding/decoding
- Idempotency logic

---

## Phase 3: Patterns from AgentSwarm (Priority: MEDIUM-LOW)

### 3.1 Concurrency Limiter for Webhook Dispatch
```typescript
// Limit concurrent webhook deliveries to prevent overwhelming recipients
const webhookLimiter = new ConcurrencyLimiter(10);

async function deliverWebhook(webhook, event, payload) {
  await webhookLimiter.acquire();
  try {
    // ... deliver webhook ...
  } finally {
    webhookLimiter.release();
  }
}
```

### 3.2 Health Monitoring Endpoint
```
GET /api/v1/health
Response: { ok: true, data: { database: "connected", uptime: 12345 } }
```

### 3.3 Structured Logging (NDJSON)
Replace console.log with structured logger:
```typescript
const logger = {
  info: (message: string, data?: Record<string, unknown>) =>
    console.log(JSON.stringify({ timestamp: Date.now(), level: 'info', message, ...data })),
  error: (message: string, data?: Record<string, unknown>) =>
    console.error(JSON.stringify({ timestamp: Date.now(), level: 'error', message, ...data })),
};
```

### 3.4 Multi-Provider LLM Support (Reviewer Agent)
If building the Reviewer Agent:
```typescript
class LLMClient {
  private providers: Map<string, ProviderConfig>;

  async evaluate(task: Task, deliverable: Deliverable): Promise<ReviewVerdict> {
    const provider = this.selectProvider(task); // poster key → freelancer key → none
    if (!provider) return { verdict: 'skipped', reason: 'No LLM key available' };

    const response = await this.complete(provider, [
      { role: 'system', content: REVIEWER_PROMPT },
      { role: 'user', content: buildReviewPrompt(task, deliverable) },
    ]);

    return parseVerdict(response); // PASS or FAIL
  }
}
```

### 3.5 Iterative Review Pattern (from Discovery Planning)
Instead of one-shot review, iterate:
```
Pass 1: Check basic requirements (does deliverable address task?)
Pass 2: Check quality (code compiles, tests pass)
Pass 3: Check edge cases (error handling, validation)
→ Aggregate into PASS/FAIL with structured feedback
```

---

## Phase 4: Deployment & Polish (Priority: HIGH when ready)

### 4.1 Deploy to Vercel
```bash
npm install -g vercel
vercel deploy --prod
```

### 4.2 Database Setup
- Create Neon/Supabase PostgreSQL instance
- Set `DATABASE_URL` in Vercel environment
- Run `npm run db:push` to sync schema
- Run `npm run db:seed` to seed categories

### 4.3 Environment Variables in Vercel
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=https://your-app.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ENCRYPTION_KEY=<openssl rand -hex 32>
```

### 4.4 Pre-Submission Checklist
- [ ] Live URL accessible
- [ ] API responds at `/api/v1/tasks`
- [ ] Can register new user → 500 credits
- [ ] Can create task → status "open"
- [ ] Can create agent → get API key → 100 credits to operator
- [ ] `curl GET /api/v1/tasks` returns tasks
- [ ] `curl POST /api/v1/tasks/:id/claims` works
- [ ] Accept claim in UI
- [ ] `curl POST /api/v1/tasks/:id/deliverables` works
- [ ] Accept deliverable in UI → credits flow
- [ ] ≥3 Skill files exist and match API behavior
- [ ] DECISIONS.md present
- [ ] .env.example present
- [ ] No secrets committed

---

## Summary of Patterns to Adopt

| Pattern | Source | Impact | Effort |
|---------|--------|--------|--------|
| Skill files | Spec | CRITICAL (20% score) | 3-4 hours |
| Bulk claims endpoint | Spec | HIGH (Tier 2) | 1-2 hours |
| Webhook deletion | Spec | MEDIUM | 30 min |
| DECISIONS.md | Spec | HIGH (10% score) | 1 hour |
| State machine map | Automaton | MEDIUM (code quality) | 30 min |
| Constitution file | Automaton | LOW (documentation) | 30 min |
| Vitest testing | Automaton | MEDIUM (code quality) | 2-3 hours |
| Concurrency limiter | AgentSwarm | LOW (optimization) | 30 min |
| Structured logging | AgentSwarm | LOW (observability) | 1 hour |
| Multi-provider LLM | AgentSwarm | BONUS (+10 pts) | 4-6 hours |
| Deployment | Spec | CRITICAL (DQ if missing) | 1-2 hours |

**Recommended order:** Deployment → Skill files → DECISIONS.md → Bulk claims → State machine → Testing → Reviewer Agent
