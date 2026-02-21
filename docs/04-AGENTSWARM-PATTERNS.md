# AgentSwarm Repository — Patterns & Techniques
> Source: `agentswarm/` repository — A distributed autonomous coding orchestration system

## Overview

AgentSwarm is a **production-grade distributed orchestration system** for massively parallel AI agent work. It orchestrates 100+ concurrent LLM-powered agents working on the same repository, compressing weeks of development into hours.

**Core Innovation:** Instead of serial execution or batch planning, uses **iterative discovery planning** — the planner continuously re-plans based on completed work, discovering dependencies in real-time.

## Architecture

```
ORCHESTRATOR (Node.js/TypeScript)
├── Planner Loop (Streaming, Continuous)
├── TaskQueue (Priority Heap + State Machine)
├── WorkerPool (Ephemeral Sandbox Manager)
├── MergeQueue (Async Background Merging)
├── GitMutex (Serialized Git Operations)
├── Monitor (Metrics, Health, Timeouts)
├── Reconciler (Self-Healing Build/Test Checks)
└── Subplanner (Recursive Task Decomposition)

SANDBOXES (Modal — Ephemeral)
├── 100 concurrent worker sandboxes
├── Each: clone repo → execute → commit → push → terminate
└── Zero persistent state (all state in Git)

DASHBOARD (Python Rich TUI)
└── Real-time metrics, agent grid, merge queue, activity feed
```

## Key Patterns to Apply to TaskHive

### 1. Streaming Dispatch (Non-Blocking Parallelism)

Instead of batch-and-wait, the planner dispatches tasks immediately and keeps planning:

```typescript
while (running) {
  collectCompletedHandoffs();

  const hasCapacity = activeWorkers < maxWorkers;
  const hasHandoffs = handoffsSinceLastPlan.length >= 3;

  if (hasCapacity && (firstIteration || hasHandoffs || noActiveWork)) {
    const newTasks = await plan(request, repoState, handoffs);
    dispatchTasks(newTasks); // Non-blocking
    handoffsSinceLastPlan = [];
  }

  if (planningDone && noActiveWork) break;
  await sleep(500);
}
```

**Application to TaskHive:** When building the Reviewer Agent or any background processing, use this pattern — don't block waiting for LLM responses. Process results as they arrive.

### 2. Ephemeral Workers (Zero Persistent State)

Each task gets a new sandbox: create → execute → destroy. No session state.

**Benefits:**
- No session state to manage
- Retry = new execution against same branch
- Fault-tolerant (failure doesn't corrupt pool)
- Horizontally scalable

**Application to TaskHive:** When agents perform work, treat each task execution as stateless. The task record in DB is the only state. If a reviewer agent crashes, restart fresh from the task data.

### 3. Priority-Based Task Queue with State Machine

```typescript
const VALID_TRANSITIONS = {
  pending: ['assigned'],
  assigned: ['running'],
  running: ['complete', 'failed'],
  failed: ['pending'], // retry
  complete: [],
  cancelled: [],
};

class TaskQueue {
  private heap: Task[]; // Min-heap by (priority, createdAt)

  enqueue(task: Task): void { /* validate + insert */ }
  getNextPending(): Task | null { /* dequeue highest priority */ }
  updateStatus(taskId: string, newStatus: TaskStatus): void {
    // Validate transition before accepting
    if (!VALID_TRANSITIONS[current].includes(newStatus)) throw Error;
  }
}
```

**Application to TaskHive:** Apply this same pattern to the task lifecycle. Priority ordering could rank tasks by urgency (deadline proximity, budget size).

### 4. Concurrency Limiter (Counting Semaphore)

```typescript
class ConcurrencyLimiter {
  private active = 0;
  private waitQueue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    return new Promise(resolve => this.waitQueue.push(resolve));
  }

  release(): void {
    this.active--;
    const next = this.waitQueue.shift();
    if (next) { this.active++; next(); }
  }
}
```

**Application to TaskHive:** Use for rate limiting webhook dispatches, controlling concurrent LLM API calls in the Reviewer Agent, or limiting database connection usage.

### 5. Self-Healing Reconciler

Periodically sweeps for failures and auto-generates fix tasks:

```typescript
class Reconciler {
  async sweep(): Promise<SweepResult> {
    // 1. Check for merge conflict markers
    const conflicts = await grep('<<<<<<< ');
    // 2. Run TypeScript compiler
    const tscResult = await exec('tsc --noEmit');
    // 3. Run build
    const buildResult = await exec('npm run build');
    // 4. Run tests
    const testResult = await exec('npm test');
    // 5. Parse errors, classify root causes
    // 6. Generate targeted fix tasks (max 5)
    return { fixTasks, buildOk, testsOk };
  }
}

// Adaptive intervals
if (hasErrors) {
  interval = Math.max(minInterval, interval / 2); // Speed up checking
} else {
  consecutiveGreen++;
  if (consecutiveGreen >= 3) {
    interval = Math.min(maxInterval, interval * 1.5); // Back off
  }
}
```

**Application to TaskHive:** Build health-check endpoints. The Reviewer Agent could act as a reconciler — periodically checking deliverables against task requirements and auto-generating revision requests.

### 6. Rich Handoff Objects (Worker → Orchestrator)

Workers don't just return success/fail — they return intelligence:

```typescript
interface Handoff {
  taskId: string;
  status: 'complete' | 'partial' | 'blocked' | 'failed';
  summary: string;           // What was done (2-4 sentences)
  filesChanged: string[];    // Changed file paths
  concerns: string[];        // Issues discovered
  suggestions: string[];     // Recommendations for next steps
  metrics: {
    tokensUsed: number;
    toolCallCount: number;
    durationMs: number;
  };
}
```

**Application to TaskHive:** When agents deliver work, the deliverable content could include structured metadata beyond just the work product — concerns, suggestions for the poster, quality metrics.

### 7. Iterative Discovery Planning

Don't enumerate all tasks upfront. Plan only what you can confidently specify:

```
Iteration 0: Initial plan (foundational tasks only)
Workers execute → return handoffs with concerns/suggestions
Iteration 1: Re-plan based on what workers learned
Workers execute → return more handoffs
Iteration 2: Refined plan with full dependency knowledge
...
```

**Scratchpad (Durable Memory):**
```
1. Goals & Specs — Full feature set, coverage status
2. Current State — What's built, broken, in-progress
3. Sprint Reasoning — Why this set of tasks
4. Worker Intelligence — Patterns from handoffs, unresolved concerns
```

**Application to TaskHive:** The Reviewer Agent could use iterative evaluation — first pass checks basic requirements, second pass checks quality, third pass checks edge cases.

### 8. Delta Compression (Context Management)

Only send changes, not full state on every iteration:

```typescript
// Hash FEATURES.json and SPEC.md
const currentHash = sha256(JSON.stringify({ features, spec }));
if (currentHash === lastHash) {
  // Skip sending 40K chars of unchanged context
  sendOnlyNewHandoffs();
} else {
  sendFullContext();
  lastHash = currentHash;
}
```

**Application to TaskHive:** When agents browse tasks, use ETags/conditional requests. When the Reviewer Agent evaluates, cache unchanged task requirements.

### 9. Multi-Endpoint LLM Failover

```typescript
class LLMClient {
  private endpoints: EndpointState[];

  async complete(messages: Message[]): Promise<Response> {
    const ordered = this.selectEndpoints(); // Health-weighted
    for (const endpoint of ordered) {
      try {
        const response = await this.sendRequest(endpoint, messages);
        this.recordSuccess(endpoint);
        return response;
      } catch {
        this.recordFailure(endpoint);
        continue; // Try next endpoint
      }
    }
    throw new Error('All endpoints failed');
  }

  // Health tracking: unhealthy after 3 consecutive failures
  // Recovery probe: retry after 30s cooldown
}
```

**Application to TaskHive:** Reviewer Agent should support multiple LLM providers (OpenRouter, OpenAI, Anthropic) with automatic failover.

### 10. Distributed Tracing (OpenTelemetry)

End-to-end tracing from orchestrator → worker → LLM:

```
planner.runLoop (root)
  ├── planner.iteration
  │   ├── llm.complete
  │   └── task dispatch
  ├── worker.execute
  │   ├── sandbox.created
  │   ├── sandbox.workerStarted
  │   └── sandbox.pushed
  ├── merge.attempt
  └── reconciler.sweep
```

**Application to TaskHive:** Add `request_id` tracking across the full request lifecycle. Log webhook deliveries with timing. Track Reviewer Agent evaluation spans.

### 11. Recursive Task Decomposition (Subplanner)

Large tasks broken into independent subtasks:

```typescript
class Subplanner {
  async decompose(parentTask: Task): Promise<Task[]> {
    if (parentTask.scope.length < 4) return [parentTask]; // Don't decompose small tasks

    // Batch 1: Foundational subtasks only
    const batch1 = await planSubtasks(parentTask, 'foundations');
    await executeAll(batch1);

    // Batch 2: Implementation based on Batch 1 results
    const batch2 = await planSubtasks(parentTask, 'implementation', batch1Handoffs);
    await executeAll(batch2);

    // Aggregate results
    return aggregateHandoffs(parentTask, [...batch1, ...batch2]);
  }
}
```

**Application to TaskHive:** Complex tasks could be decomposed into subtasks. An agent could claim a task and propose splitting it into sub-deliverables.

## Key Design Principles

| Principle | Description | TaskHive Application |
|-----------|-------------|---------------------|
| **Streaming Dispatch** | Don't block; dispatch and keep working | Background webhook delivery, async review |
| **Ephemeral Workers** | Stateless execution, state in DB only | Agent sessions are stateless; task DB is truth |
| **Git as Truth** | All state stored in a single source | Database is the single source of truth |
| **Iterative Discovery** | Re-plan as you learn | Reviewer Agent iterates on evaluation |
| **Self-Healing** | Auto-detect and fix failures | Health checks, auto-revision requests |
| **Constraint-Based Tasks** | Rigorous acceptance criteria | Task requirements as executable contracts |
| **Rich Handoffs** | Workers report concerns + suggestions | Deliverables include quality metadata |

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Orchestrator | TypeScript (Node.js) |
| Workers | Python subprocess + Modal sandboxes |
| Agent SDK | Pi Coding Agent SDK |
| LLM | GLM-5 (custom, multi-endpoint) |
| Build Tool | Turbo (monorepo) |
| Package Mgr | pnpm |
| Testing | Node.js built-in test runner |
| Dashboard | Python Rich (TUI) |
| Tracing | OpenTelemetry (custom) |
| Logging | NDJSON (structured) |

## File Reference

```
agentswarm/
├── packages/
│   ├── core/src/ — types.ts, logger.ts, tracer.ts, protocol.ts, git.ts
│   ├── orchestrator/src/ — main.ts, orchestrator.ts, config.ts, planner.ts,
│   │                        task-queue.ts, worker-pool.ts, merge-queue.ts,
│   │                        monitor.ts, reconciler.ts, subplanner.ts,
│   │                        llm-client.ts, shared.ts, scope-tracker.ts
│   └── sandbox/src/ — worker-runner.ts, handoff.ts
├── prompts/ — root-planner.md, worker.md, subplanner.md, reconciler.md
├── infra/ — spawn_sandbox.py, sandbox_image.py
└── dashboard.py (748 lines, Python Rich TUI)
```
