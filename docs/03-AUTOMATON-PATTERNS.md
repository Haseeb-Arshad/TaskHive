# Automaton Repository — Patterns & Techniques
> Source: `automaton/` repository — Another TaskHive implementation with strong automation patterns

## Overview

The automaton repo is a **sophisticated Next.js TaskHive implementation** with the same tech stack (Next.js 15, Drizzle, PostgreSQL, NextAuth) but with deeper attention to:
- State machine enforcement
- Webhook-driven automation
- Agent autonomy design
- Code organization and abstractions
- Testing infrastructure (Vitest)

## Tech Stack (Same as TaskHive)
- Next.js 15.1, TypeScript 5.7 (strict), PostgreSQL, Drizzle ORM 0.38
- NextAuth.js 4.24, bcryptjs, Zod 3.24, Tailwind CSS 4.0
- **Additional:** Vitest 4.0.18 for testing, `constitution.md` for governance

## Key Patterns to Adopt

### 1. Constitution-Based Governance

The `constitution.md` file defines **immutable rules** for the platform:

```markdown
# Platform Constitution
- Credits are reputation signals, not currency
- Budget is a promise, never escrowed
- Append-only ledger: NEVER update/delete credit transactions
- Agent API keys: SHA-256 hashed, never stored raw
- Rate limit: 100 req/min per API key
- All API responses use standard envelope
- Integer IDs exposed to agents (not UUIDs)
- Error responses ALWAYS include suggestion field
```

**Why this matters:** It acts as a single source of truth for business rules. Every developer (and AI agent) can reference it to ensure consistency. Prevents drift between documentation and implementation.

**Adoption:** Create a `CONSTITUTION.md` in TaskHive root that codifies all invariants.

### 2. Strict State Machine Enforcement

Rather than ad-hoc status checks, automaton implements **explicit transition validation:**

```typescript
// State transition map — the ONLY valid transitions
const VALID_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  open: ['claimed', 'cancelled'],
  claimed: ['in_progress', 'cancelled'],
  in_progress: ['delivered', 'cancelled'],
  delivered: ['completed', 'in_progress', 'disputed'],
  completed: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

function validateTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

// Used in every status update
function transitionTaskStatus(taskId: number, newStatus: TaskStatus) {
  const task = await getTask(taskId);
  if (!validateTransition(task.status, newStatus)) {
    throw new InvalidTransitionError(task.status, newStatus);
  }
  // ... proceed with update
}
```

**Why this matters:** Prevents invalid states (e.g., going from "open" directly to "completed"). Self-documenting code.

### 3. Event-Driven Architecture with Webhooks

Automaton treats webhooks as **first-class infrastructure**, not an afterthought:

```typescript
// Event bus pattern
class EventBus {
  private listeners = new Map<WebhookEvent, Set<EventHandler>>();

  on(event: WebhookEvent, handler: EventHandler): void { ... }
  emit(event: WebhookEvent, data: EventPayload): void {
    // 1. Find all webhooks subscribed to this event
    // 2. Sign payload with HMAC-SHA256
    // 3. Dispatch asynchronously (fire-and-forget)
    // 4. Log delivery in webhook_deliveries
  }
}

// Events emitted at every state transition
function acceptClaim(taskId: number, claimId: number) {
  // ... business logic ...
  eventBus.emit('claim.accepted', { task_id: taskId, claim_id: claimId });
  eventBus.emit('claim.rejected', { /* for each rejected claim */ });
}
```

**Events supported:**
- `task.new_match` — New task posted matching agent's categories
- `claim.accepted` — Agent's claim was accepted
- `claim.rejected` — Agent's claim was rejected
- `deliverable.accepted` — Agent's work was accepted
- `deliverable.revision_requested` — Revision needed

### 4. Handler Composition Pattern

Instead of raw route handlers, automaton uses composable middleware:

```typescript
// withAgentAuth wraps handlers with auth + rate limiting
export function withAgentAuth(
  handler: (req: NextRequest, agent: Agent, rateLimit: RateLimitResult) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    // 1. Authenticate agent
    const authResult = await authenticateAgent(request);
    if ('error' in authResult) return authResult;

    // 2. Check rate limit
    const rateLimit = checkRateLimit(`agent:${authResult.id}`);

    // 3. Check idempotency (if header present)
    const idempotencyKey = request.headers.get('idempotency-key');
    if (idempotencyKey) {
      const idempResult = await checkIdempotency(authResult.id, idempotencyKey, ...);
      if (idempResult.action === 'replay') return idempResult.response;
    }

    // 4. Call actual handler
    const response = await handler(request, authResult, rateLimit);

    // 5. Add rate limit headers
    response.headers.set('X-RateLimit-Limit', String(rateLimit.limit));
    response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
    response.headers.set('X-RateLimit-Reset', String(rateLimit.resetAt));

    // 6. Store idempotency result
    if (idempotencyKey && idempResult?.recordId) {
      await completeIdempotency(idempResult.recordId, response);
    }

    return response;
  };
}
```

### 5. Centralized Error Factory

All errors created through factory functions ensuring consistency:

```typescript
// Every error type has a dedicated factory
export function taskNotFoundError(id: number) {
  return errorResponse(404, {
    code: 'TASK_NOT_FOUND',
    message: `Task ${id} does not exist`,
    suggestion: 'Use GET /api/v1/tasks to browse available tasks',
  });
}

export function duplicateClaimError(taskId: number) {
  return errorResponse(409, {
    code: 'DUPLICATE_CLAIM',
    message: `You already have a pending claim on task ${taskId}`,
    suggestion: `Check your claims with GET /api/v1/agents/me/claims`,
  });
}

// 14+ error factory functions covering all scenarios
```

### 6. Transaction-Safe Credit Operations

All credit operations wrapped in database transactions:

```typescript
async function processTaskCompletion(operatorId: number, budget: number, taskId: number) {
  return db.transaction(async (tx) => {
    const fee = Math.floor(budget * PLATFORM_FEE_PERCENT / 100);
    const payment = budget - fee;

    // 1. Atomic balance update
    const [updated] = await tx.update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${payment}` })
      .where(eq(users.id, operatorId))
      .returning({ creditBalance: users.creditBalance });

    // 2. Payment ledger entry
    await tx.insert(creditTransactions).values({
      userId: operatorId, amount: payment, type: 'payment',
      taskId, balanceAfter: updated.creditBalance,
      description: `Task ${taskId} completion payment`,
    });

    // 3. Fee tracking entry
    await tx.insert(creditTransactions).values({
      userId: operatorId, amount: 0, type: 'platform_fee',
      taskId, balanceAfter: updated.creditBalance,
      description: `Platform fee: ${fee} credits (${PLATFORM_FEE_PERCENT}% of ${budget})`,
    });

    return { payment, fee, balanceAfter: updated.creditBalance };
  });
}
```

### 7. Auth Cache for Performance

Agent auth lookups cached in globalThis to survive hot reloads:

```typescript
const AUTH_CACHE_TTL_MS = 5_000; // 5 seconds
const authCache: Map<string, { agent: Agent, expiresAt: number }> =
  (globalThis as any).__agentAuthCache ??= new Map();

// Check cache before DB query
const cached = authCache.get(keyHash);
if (cached && Date.now() < cached.expiresAt) {
  return cached.agent; // Skip DB call
}
```

### 8. Comprehensive Validation with Zod

Every input validated with Zod schemas:

```typescript
const createTaskSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  requirements: z.string().max(5000).optional(),
  budget_credits: z.number().int().min(10),
  category_id: z.number().int().optional(),
  deadline: z.string().datetime().optional(),
  max_revisions: z.number().int().min(0).max(5).default(2),
});

const createClaimSchema = z.object({
  proposed_credits: z.number().int().min(1),
  message: z.string().max(1000).optional(),
});
```

### 9. Webhook Dispatch with HMAC Signing

```typescript
function signPayload(secret: string, body: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

// Headers sent with every webhook:
// X-TaskHive-Signature: sha256=<hmac>
// X-TaskHive-Event: claim.accepted
// X-TaskHive-Timestamp: <ISO>
```

### 10. AES-256-GCM Encryption for LLM Keys

```typescript
// Store encrypted: iv_hex:authTag_hex:ciphertext_base64
export function encryptKey(plaintext: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

## Testing Infrastructure

- Uses **Vitest** for unit & integration testing
- Test configuration in `vitest.config.ts`
- Tests for: validators, state machine transitions, credit calculations, auth logic

## Key Takeaways for Our Implementation

1. **Extract state machine into explicit transition map** — Self-documenting, prevents bugs
2. **Create constitution.md** — Single source of truth for invariants
3. **Event bus for webhooks** — Clean separation of concerns
4. **Handler composition** — DRY auth/rate-limit/idempotency middleware
5. **Error factories** — Consistent error responses everywhere
6. **Transaction-safe credits** — Atomic operations prevent inconsistencies
7. **Auth cache** — Reduce DB queries under load
8. **Add Vitest** — Test critical paths (state machine, credits, auth)
