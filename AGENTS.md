# TaskHive Frontend Agent Manual

## Identity

`TaskHive/` is the Next.js product application. It owns:

- human-facing UI
- dashboard workflows
- server actions for authenticated users
- frontend integration with the Python backend
- agent-readable skill files under `skills/`

## Mission

Work here when the task is primarily about product behavior at the UI layer or the agent-readable contract layer.

Typical tasks:

- dashboard features
- task detail and conversation UX
- auth flows
- frontend validation and data fetching
- keeping `skills/*.md` aligned with the live API contract

## Scope

Primary areas:

- `src/app/(auth)/` - login and registration pages
- `src/app/(dashboard)/` - authenticated dashboard and task detail UX
- `src/app/api/auth/` - auth routes used by the web app
- `src/app/api/orchestrator/` - orchestrator proxy/preview/progress routes
- `src/lib/actions/` - server actions used by the UI
- `src/lib/api-client.ts` - frontend-to-backend HTTP bridge
- `src/lib/auth/` - NextAuth session helpers
- `src/lib/db/` - frontend project schema and seed helpers
- `skills/` - micro-verbose endpoint guides for outside agents
- `tests/integration/` - Vitest integration coverage

## Non-Goals

Do not treat this project as the authoritative MCP or REST backend implementation. The checked-in runtime backend currently lives in `../taskhive-api/`.

Do not add large backend behavior here unless the user explicitly asks for a frontend-backend migration.

## Read Order

Read these before large changes:

1. `AGENTS.md` in the workspace root
2. this file
3. `README.md`
4. `DECISIONS.md`
5. `AI_AGENT_GUIDE.md` if you need lifecycle or contract context
6. the exact feature files you plan to edit

## Current Runtime Reality

Important: older docs in this repo describe a full Next.js `/api/v1` implementation. The current checked-in frontend instead talks to the Python backend through `src/lib/api-client.ts`.

Current behavior:

- `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8000`
- server actions call backend endpoints like `/api/v1/user/tasks`
- orchestrator progress routes exist inside the Next.js app, but the authoritative task/claim/deliverable behavior lives in `../taskhive-api/`
- deployment-level external agent entrypoints are `/.well-known/taskhive-agent.json` and `/agent-access`

If you change the API contract, you almost certainly need a coordinated change in `../taskhive-api/`.

## System Model

For external agents, the safest mental model is:

- `TaskHive/` renders the product and calls the backend
- `taskhive-api/` enforces the actual task lifecycle
- `skills/*.md` remain the agent-readable API contract and must not drift from the real backend

## Files Of Record

Start from these files depending on the task:

- `src/lib/api-client.ts` - base URL, timeout, fetch behavior
- `src/lib/actions/tasks.ts` - task creation, accept/revision, messaging actions
- `src/app/(dashboard)/dashboard/tasks/[id]/page.tsx` - task detail screen
- `src/app/api/orchestrator/...` - execution preview/progress routes
- `skills/*.md` - agent-facing contract docs

## Change Rules

When changing frontend behavior:

1. Trace the UI entry point.
2. Trace the matching server action.
3. Trace the backend endpoint being called through `apiClient`.
4. Confirm whether the change is frontend-only or contract-level.

When changing any field or endpoint shape:

1. update frontend callers
2. update the matching skill file
3. update backend implementation in `../taskhive-api/` if needed
4. update visible docs only where they are still used as entrypoints

## Verification

Use these commands from `TaskHive/`:

- `npm install`
- `npm run lint`
- `npm run test`
- `npm run build`

Use targeted checks when possible:

- task or state-machine UI work: `npm run test -- state-machine`
- auth and access work: `npm run test -- auth-access-control`
- pagination/rate-limit surface work: `npm run test -- pagination` or matching integration tests

## Common Traps

- Do not assume `src/app/api/v1` exists here. Verify the actual code tree first.
- Do not update `skills/*.md` without verifying the backend still matches.
- Do not change `NEXT_PUBLIC_API_URL` assumptions without checking `taskhive-api/AGENTS.md`.
- Do not fix a UI bug by silently changing contract expectations unless the backend is updated too.

## Done Criteria

Frontend work is done when:

- the UI behavior is correct
- the server action matches the backend contract
- the related skill file is still accurate
- `npm run lint`, `npm run test`, and `npm run build` pass when relevant
