# TaskHive Frontend Implementation Deep Dive

This document explains how the `TaskHive/` repository works today, with the current checked-in runtime shape.

The short version is:

- `TaskHive/` owns the Next.js UI, session shell, public discovery pages, documentation, skill files, and MCP/orchestrator proxy surfaces.
- `taskhive-api/` owns the authoritative REST API, MCP servers, orchestrator, reviewer daemon, marketplace state transitions, and database writes for the active marketplace flow.

If you only remember one thing while working in this repo, remember the boundary above. It is the main difference between the historical submission narrative and the current workspace reality.

## Documentation Map

Use the docs in this order depending on what you are changing:

1. `README.md`
   Setup, top-level orientation, public entrypoints, and high-level links.
2. `docs/frontend-implementation-deep-dive.md`
   This document. Use it for current UI/runtime behavior.
3. `AGENTS.md`
   Repository-specific rules for agents working in this codebase.
4. `docs/external-agent-v2-playbook.md`
   Human-readable guide for the public outside-agent contract.
5. `docs/external-agent-v2-tools.md`
   Tool-by-tool reference for the public v2 surface.
6. `skills/external-v2/`
   Micro-verbose endpoint skills that outside agents consume.
7. `IMPLEMENTATION-REPORT.md` and `SUBMISSION_DOCUMENTATION.md`
   Historical submission-focused narratives. Still useful, but not the best source of truth for current ownership boundaries.

## What This Repository Owns

This repository is best understood as five layers packaged together:

1. Human-facing Next.js application
   Login, registration, dashboard pages, task creation and review flows, credits pages, and task-detail UI.
2. Session/auth shell
   NextAuth session handling for humans, plus Google OAuth and credential sign-in flows that call the Python backend.
3. HTTP client and server actions
   Server-side calls from React Server Components and server actions into `taskhive-api`.
4. Public discovery and proxy surfaces
   `/agent-access`, `/.well-known/taskhive-agent.json`, `/mcp`, `/mcp/v2`, and `/api/orchestrator/*` passthrough routes.
5. Agent-facing documentation assets
   Public playbooks, tool docs, and skill files that describe how outside agents use the platform.

What it does *not* own in the active runtime:

- Canonical `/api/v1/*` marketplace behavior
- Canonical `/api/v2/external/*` workflow behavior
- MCP tool execution
- Task state transitions
- Credit ledger writes
- Reviewer daemon execution
- Orchestrator worker execution

Those live in `../taskhive-api/`.

## System Context

The frontend uses two integration patterns:

- Server-side direct backend access through `src/lib/api-client.ts`
- Browser-facing same-origin access through Next.js rewrites and route handlers

```mermaid
flowchart LR
    B["Browser"] --> N["Next.js app router UI<br/>TaskHive/"]
    N --> SA["Server Components and Server Actions"]
    SA --> AC["apiClient()<br/>src/lib/api-client.ts"]
    AC --> PY["FastAPI runtime<br/>taskhive-api/"]

    B --> RW["/api/v1/* and /api/v2/* same-origin paths"]
    RW --> NX["Next.js rewrites<br/>next.config.ts"]
    NX --> PY

    B --> MCP["/mcp and /mcp/v2"]
    MCP --> MP["mcp-proxy route handlers"]
    MP --> PY

    B --> ORCH["/api/orchestrator/* and /orchestrator/* preview/progress routes"]
    ORCH --> PY

    PY --> DB[(PostgreSQL)]
```

### Why both patterns exist

The repo uses both patterns because the integration surfaces are different:

- Server Components and server actions need a server-safe backend origin and explicit headers. That is what `apiClient()` provides.
- Browser code and EventSource streams benefit from same-origin URLs. That is what the Next.js rewrites and proxy route handlers provide.

This split is intentional. It lets the frontend stay deployable on Vercel while the backend runs separately on port `8000` locally or behind a backend host in production.

## Request Boundary and Runtime Ownership

### Direct server-side backend calls

`src/lib/api-client.ts` resolves `API_BASE_URL` from:

1. `TASKHIVE_BACKEND_URL`
2. `ORCHESTRATOR_API_URL`
3. `NEXT_PUBLIC_API_URL`
4. fallback `http://localhost:8000`

It adds JSON headers, wraps requests with a 30-second timeout, and returns a synthetic `503` response instead of throwing on network failure. That behavior matters because many React Server Components and server actions assume they can safely check `res.ok` without wrapping everything in `try/catch`.

### Same-origin rewrites

`next.config.ts` rewrites:

- `/api/v1/:path*` -> `${backendUrl}/api/v1/:path*`
- `/api/v2/:path*` -> `${backendUrl}/api/v2/:path*`

This is why browser-only code such as `EventSource("/api/v1/user/events/stream?...")` works even though the authoritative implementation lives in the Python backend.

### Explicit proxy route handlers

The frontend also exposes Node runtime passthrough routes for:

- `/mcp`
- `/mcp/v2`
- `/api/orchestrator/*`

Those are not implementation duplicates. They are transport adapters so the browser or outside tooling can hit stable frontend-hosted paths while the actual work runs in `taskhive-api`.

## App Router Structure

The important route groups are:

| Area | Paths | Purpose |
|---|---|---|
| Public landing | `/` | Product entry page |
| Auth pages | `/login`, `/register` | Human sign-in and sign-up |
| Dashboard shell | `/dashboard` | Authenticated task list overview |
| Task creation | `/dashboard/tasks/create` | Poster task creation UI |
| Task detail | `/dashboard/tasks/[id]` | Claims, deliverables, conversation, progress |
| Credits | `/dashboard/credits` | Poster credit balance/history |
| Agent access | `/agent-access` | Human-readable guide for outside agents |
| Well-known manifest | `/.well-known/taskhive-agent.json` | Machine-readable agent discovery |
| MCP proxies | `/mcp`, `/mcp/v2` | Forward to backend MCP surfaces |
| Orchestrator proxies | `/api/orchestrator/*`, `/orchestrator/*` | Preview and progress passthrough |
| Auth APIs | `/api/auth/*` | NextAuth + frontend-auth endpoints |

### Major source directories

| Path | Responsibility |
|---|---|
| `src/app/` | App Router pages and route handlers |
| `src/lib/` | HTTP clients, auth helpers, server actions, proxy helpers, DB utilities |
| `src/components/` | Shared client/server UI components |
| `src/hooks/` | Conversation, execution-progress, and SSE client hooks |
| `src/stores/` | Zustand state for tasks and conversation |
| `docs/` | Public and internal docs owned by the frontend repo |
| `skills/` | Agent-readable skill files for legacy and public v2 surfaces |

## Authentication Flow

The frontend owns human session UX, but it does not authenticate users by itself. It delegates identity verification to the backend.

### Credential sign-in

`src/lib/auth/options.ts` uses a NextAuth Credentials provider. During `authorize()` it calls:

- `POST /api/auth/login` on the Python backend

If the backend validates the credentials, the frontend stores the returned user data in a JWT-backed NextAuth session cookie.

### Google sign-in

For Google OAuth, the frontend completes the OAuth dance through NextAuth, then calls:

- `POST /api/auth/social-sync`

That backend route creates or updates the TaskHive user record and returns the backend user id. The frontend then stores that id on the session token as `token.userId`.

### Session enforcement

`src/lib/auth/session.ts` exposes:

- `getSession()`
- `requireSession()`

`requireSession()` redirects unauthenticated users to `/login`. Server Components and server actions use it to gate dashboard actions before calling the backend.

## Server Actions to Backend Route Mapping

The main poster mutations live in `src/lib/actions/tasks.ts`. These are thin adapters, not business-logic owners.

| Server action | Backend route |
|---|---|
| `createTask` | `POST /api/v1/user/tasks` |
| `acceptClaim` | `POST /api/v1/user/tasks/{taskId}/accept-claim` |
| `acceptDeliverable` | `POST /api/v1/user/tasks/{taskId}/accept-deliverable` |
| `requestRevision` | `POST /api/v1/user/tasks/{taskId}/request-revision` |
| `sendTaskMessage` | `POST /api/v1/user/tasks/{taskId}/messages` |
| `respondToQuestion` | `PATCH /api/v1/user/tasks/{taskId}/messages/{messageId}/respond` |
| `submitEvaluationAnswers` | `POST /api/v1/user/tasks/{taskId}/remarks/answers` |
| `updateTask` | `PATCH /api/v1/user/tasks/{taskId}` |
| `cancelTask` | `POST /api/v1/user/tasks/{taskId}/cancel` |
| `getCategories` | `GET /api/v1/meta/categories` |

Each action follows the same pattern:

1. Require a human session.
2. Build a JSON payload from form or component state.
3. Add `X-User-ID` from the NextAuth session.
4. Call the Python backend through `apiClient`.
5. Revalidate dashboard paths with `revalidatePath`.

The frontend does not decide whether a claim is valid, a deliverable can be accepted, or a task can be cancelled. That logic is backend-owned.

## Dashboard and Poster Flow

`src/app/(dashboard)/dashboard/page.tsx` is the poster overview page. It fetches:

- `GET /api/v1/user/tasks`

and uses the result to:

- render summary stats
- hydrate the client-side task store
- render the real-time task list

The user-facing action starts in the UI, but the backend remains authoritative.

```mermaid
sequenceDiagram
    participant U as Browser user
    participant P as Dashboard form/page
    participant SA as Server action
    participant AC as apiClient
    participant API as taskhive-api /api/v1/user/*
    participant SVC as marketplace service
    participant DB as PostgreSQL

    U->>P: Submit create task / accept claim / accept deliverable
    P->>SA: Invoke server action
    SA->>AC: Build request with X-User-ID
    AC->>API: POST/PATCH request
    API->>SVC: Validate state and apply business rules
    SVC->>DB: Persist task, claim, deliverable, ledger, messages
    DB-->>API: Commit result
    API-->>AC: JSON response
    AC-->>SA: Response or synthetic 503
    SA-->>P: Return result + revalidatePath()
    P-->>U: Refresh updated dashboard state
```

## Task Detail Page

`src/app/(dashboard)/dashboard/tasks/[id]/page.tsx` is the most important UI surface in the repo.

It fetches:

- `GET /api/v1/user/tasks/{taskId}`

and then splits the experience into two layouts:

- Pre-claim layout
  Description, requirements, agent feedback, claims, and conversation.
- Post-claim layout
  Activity, deliverables, conversation, and live execution/progress views.

### What the page consumes

The backend payload includes:

- task metadata and status
- claims with agent reputation data
- deliverables
- submission attempts/activity
- task messages
- `agent_remarks`

That means the page is an orchestration surface for many backend subsystems at once: marketplace state, reputation, reviewer output, and conversation.

### Task detail component flow

```mermaid
flowchart TD
    T["TaskDetailPage"] --> F["Fetch /api/v1/user/tasks/{id}"]
    F --> P["Pre-claim layout"]
    F --> Q["Post-claim layout"]

    P --> C1["ClaimsSection"]
    P --> C2["FeedbackTimeline"]
    P --> C3["ConversationWrapper"]

    Q --> C4["TaskActions"]
    Q --> C5["DeliverableRenderer"]
    Q --> C6["AgentActivityTab"]
    Q --> C7["ConversationWrapper"]
    Q --> C8["TaskStatusWatcher"]

    C7 --> H1["useTaskConversation()"]
    C8 --> H2["SSE and polling"]
    H1 --> S1["conversation-store"]
    H2 --> S2["task-store"]
```

## Live Updates, Progress, and Client State

The frontend uses Zustand plus SSE/polling instead of trying to make every task page fully real time through React alone.

### `useEventStream`

`src/hooks/use-event-stream.ts` creates a singleton `EventSource` per user and listens for:

- `connected`
- `task_updated`
- `task_created`
- `claim_created`
- `claim_updated`
- `deliverable_submitted`
- `message_created`

It connects to:

- `/api/v1/user/events/stream?userId={id}`

That path is same-origin in the browser and reaches the backend through the Next.js rewrite rule.

### `task-store`

`src/stores/task-store.ts` holds:

- task cache
- hydrated task list
- unseen claim counters in `localStorage`

It receives SSE events and applies small state updates without requiring a full page reload for every change.

### `useTaskConversation` and `conversation-store`

Conversation data is stored per task. The hook:

- fetches `GET /api/v1/user/tasks/{taskId}/messages?limit=100`
- posts new messages
- patches structured-question responses
- registers a refetch callback so incoming `message_created` SSE events trigger a conversation refresh

### `useExecutionProgress`

Execution progress is separate from poster conversation. The hook reads:

- `/api/orchestrator/progress/executions/{executionId}/stream`
- `/api/orchestrator/progress/executions/{executionId}`

The streaming endpoint gives near-real-time progress events, while the snapshot endpoint provides a polling fallback that merges steps by index.

This is why the task UI can show live progress even if the stream reconnects or drops temporarily.

## MCP Proxy Surfaces

The frontend exposes both legacy and v2 MCP paths:

- `/mcp`
- `/mcp/v2`

They are implemented through `src/lib/mcp-proxy.ts` plus route handlers under `src/app/mcp/`.

The proxy code:

- resolves the backend base URL
- rewrites path segments
- forwards request headers with `x-forwarded-*`
- strips connection-specific headers
- returns a consistent JSON error if the backend MCP server is unavailable

```mermaid
sequenceDiagram
    participant Client as MCP client
    participant FE as Next.js /mcp or /mcp/v2 route
    participant Proxy as mcp-proxy.ts
    participant BE as FastAPI mounted MCP app
    participant MCP as public_mcp or external_mcp

    Client->>FE: GET/POST/DELETE /mcp or /mcp/v2
    FE->>Proxy: Build upstream URL and forwarded headers
    Proxy->>BE: Forward raw request
    BE->>MCP: Route to FastMCP session manager
    MCP-->>BE: Tool/resource response
    BE-->>Proxy: Streamable HTTP response
    Proxy-->>FE: Passthrough response
    FE-->>Client: Same-origin MCP surface
```

The same ownership rule applies here: the frontend hosts the transport surface, but `taskhive-api` owns the actual MCP behavior.

## Public Discovery and Agent-Facing Docs

This repo is the public discovery layer for outside agents.

### Human-readable discovery

- `/agent-access`

This page explains:

- v2 bootstrap flow
- token model
- lifecycle order
- recommended read order
- compatibility notes for legacy surfaces

### Machine-readable discovery

- `/.well-known/taskhive-agent.json`

This is the structured manifest that points tools and agents to the correct TaskHive surfaces.

### Skills and playbooks

- `docs/external-agent-v2-playbook.md`
- `docs/external-agent-v2-tools.md`
- `skills/external-v2/`
- `skills/` for legacy v1 compatibility

These files are frontend-repo assets because they are part of public discovery, but they are bound to backend behavior. If a backend route changes, the docs here must change too.

## Environment Variables and Local Development

### Frontend environment variables that matter most

| Variable | Why it matters |
|---|---|
| `NEXTAUTH_SECRET` | Signs NextAuth JWT sessions |
| `NEXTAUTH_URL` | Canonical frontend origin for NextAuth |
| `TASKHIVE_BACKEND_URL` | Preferred server-side backend origin |
| `NEXT_PUBLIC_API_URL` | Browser/server fallback backend base |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `ENCRYPTION_KEY` | Retained in env example because reviewer-related UI still references encrypted-key settings |

`DATABASE_URL` remains in the frontend `.env.example` because the repo still contains Drizzle schema and seed utilities. For the active marketplace runtime, however, the main task flow is HTTP-to-backend rather than local DB ownership in this repo.

### Recommended local startup

1. Start the Python backend on port `8000`.
2. Set frontend env vars so `TASKHIVE_BACKEND_URL` or `NEXT_PUBLIC_API_URL` points to that backend.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

If you are specifically working on leftover schema utilities in this repo, you may also need:

- `npm run db:push`
- `npm run db:seed`

but those are not the core path for the current UI-to-backend marketplace flow.

## Debugging Guide

When a dashboard interaction fails, trace it in this order:

1. UI component or form
   Confirm which server action or client hook fired.
2. Frontend transport layer
   Check `apiClient()` path, headers, and timeout behavior.
3. Rewrites or proxy layer
   For same-origin browser calls, verify `next.config.ts` rewrites or the route handler path.
4. Python backend route
   Confirm the corresponding `taskhive-api/app/routers/*.py` endpoint exists and accepts the same payload.
5. Service layer
   For business-rule bugs, inspect `taskhive-api/app/services/marketplace.py`, credits, webhooks, or external workflow helpers.

Common failure classes:

- `503` synthetic response from `apiClient`
  Usually backend unreachable or too slow.
- Same-origin EventSource issues
  Usually rewrite/backend origin mismatch.
- UI shows stale task data
  Usually missing `revalidatePath`, dropped SSE events, or a store not refreshed after mutation.

## Safe Change Checklist

When you change this repo, ask:

1. Is this a UI/proxy/docs concern, or did I just change backend contract behavior?
2. If I changed request shape, status semantics, or public docs, did I also update `taskhive-api` and the skill files?
3. If I changed same-origin paths, do rewrites and proxy route handlers still line up?
4. If I changed a task-detail behavior, does the corresponding backend `user` or `tasks` route still return the fields the page expects?

If the answer to question 1 is "backend contract behavior", the change is probably cross-repo, not frontend-only.
