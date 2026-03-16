# TaskHive Workspace Agent Manual

## Identity

This workspace is not a single app. It contains:

- `TaskHive/` - the Next.js product UI, dashboard, server actions, and agent-readable skill files.
- `taskhive-api/` - the Python/FastAPI backend, MCP server, reviewer agent, and orchestrator.
- `taskhive-task-*` and `taskhive-agent-*` - generated task workspaces and agent run artifacts. Treat them as outputs, not primary source code, unless the user explicitly asks you to modify them.

## Mission

If you are an external coding agent entering this workspace, your first job is routing:

1. Identify which codebase owns the change.
2. Read the matching subproject `AGENTS.md`.
3. Preserve the shared TaskHive contract across UI, API, MCP, and skill files.

Do not start editing before you know whether the change belongs to `TaskHive/`, `taskhive-api/`, or both.

## Read Order

Read these files in order before making large changes:

1. `AGENTS.md` (this file)
2. `MICROVERBOSE-STRUCTURE.md`
3. `TaskHive/docs/external-agent-v2-playbook.md` if the task touches the public outside-agent contract
4. `TaskHive/docs/external-agent-v2-tools.md` and `TaskHive/skills/external-v2/` if the task touches public v2 skill docs
5. `TaskHive/AGENTS.md` if the task touches UI, frontend flows, server actions, or skill files
6. `taskhive-api/AGENTS.md` if the task touches FastAPI, MCP, reviewer, or orchestrator behavior
5. Root challenge docs only if you need original product intent:
   - `ARCHITECTURE.md`
   - `API-CONTRACT.md`
   - `specs/`
   - `REQUIREMENTS.md`

## Shared Product Model

All meaningful changes should preserve these invariants:

- Humans use session auth.
- Agents use Bearer API keys in the format `th_agent_<64 hex chars>`.
- Core task loop:
  1. create task
  2. browse/search
  3. claim
  4. accept claim
  5. submit deliverable
  6. accept deliverable or request revision
- Credits are reputation points, not escrowed money.
- Integer IDs are the canonical public identifiers across the platform.
- The "binding rule" applies: agent-facing docs/skills, API/MCP surfaces, and implementation must stay in sync.

## Ownership Routing

Choose the project by the change surface:

 - Edit `TaskHive/` for:
   - UI, dashboard pages, auth pages, visual flows
   - server actions in `src/lib/actions`
   - frontend data fetching in `src/lib/api-client.ts`
   - agent-readable endpoint skill files in `TaskHive/skills/` and `TaskHive/skills/external-v2/`
- Edit `taskhive-api/` for:
  - REST endpoint behavior
  - auth, rate limiting, idempotency, DB models, migrations
  - MCP tool behavior and MCP transport setup
  - reviewer agent, orchestrator, prompt pipeline, execution tools
- Edit both projects for:
  - any API contract change
  - auth shape changes
  - task lifecycle/state-machine changes
  - credit or deliverable semantics
  - endpoint/path/field name changes

## Current Workspace Reality

Important: some older documentation still describes the ideal Trinity architecture as if the Next.js app contains the full `/api/v1` implementation. In the checked-in workspace today:

- `TaskHive/` is the active frontend.
- `taskhive-api/` is the active backend and MCP implementation.
- `TaskHive/src/lib/api-client.ts` points the frontend at `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000`.

Treat the Python backend as the authoritative runtime API unless the user explicitly asks you to restore or move logic into the Next.js app.

## Global Do-Not-Break Rules

- Do not edit generated `taskhive-task-*` or `taskhive-agent-*` folders unless the task is specifically about those artifacts.
- Do not change shared contract fields without updating every consumer.
- Do not change MCP transport URLs or startup commands without re-testing both HTTP and stdio access.
- Do not trust older docs blindly when they conflict with the live code. Verify the actual code path first.

## Verification Policy

Run the narrowest meaningful verification for the surface you touch:

- Frontend:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Python backend:
  - `python -m py_compile ...` for touched modules
  - `pytest tests -v`
- MCP:
  - `python -X utf8 test_mcp_e2e.py --next-url http://127.0.0.1:8000`
  - `python scripts/test_mcp_transports.py`

## Files Of Record

Use these as authoritative starting points:

- `TaskHive/AGENTS.md`
- `TaskHive/docs/external-agent-v2-playbook.md`
- `TaskHive/docs/external-agent-v2-tools.md`
- `taskhive-api/AGENTS.md`
- `TaskHive/src/lib/api-client.ts`
- `taskhive-api/app/main.py`
- `taskhive-api/taskhive_mcp/server.py`
- `TaskHive/skills/`
- `TaskHive/skills/external-v2/`

## Done Criteria

A change is not complete until:

- the owning codebase is correct
- cross-project contract consumers are updated
- agent-facing docs remain accurate
- relevant verification passes
- no stale instructions remain in the obvious entry files
