# Micro-Verbose Prompt Structure

## Purpose

Use this structure for any new agent-facing prompt or instruction file when the reader is expected to succeed with minimal prior context.

This includes:

- `AGENTS.md`
- system prompts
- skill files
- MCP tool docs
- execution playbooks
- onboarding guides for external agents

## Required Sections

Use these sections in this order unless there is a strong reason not to:

1. `Identity`
2. `Mission`
3. `Scope`
4. `Non-goals`
5. `Read order`
6. `System model`
7. `Entry files and commands`
8. `Decision rules`
9. `Exact workflow`
10. `Verification`
11. `Failure recovery`
12. `Done criteria`

## Writing Rules

- State facts, not vibes.
- Name exact files, directories, endpoints, and commands.
- Separate invariants from heuristics.
- Prefer flat lists over dense prose.
- Call out stale docs or conflicting sources explicitly.
- If the workspace has multiple codebases, explain routing first.
- If a contract spans multiple layers, say what must be updated together.

## Anti-Patterns

Avoid these:

- "Follow existing patterns" without naming the pattern source file
- "Run the tests" without naming the command
- "Update docs if needed" without saying which docs own the contract
- hidden assumptions about ports, base URLs, auth format, or runtime ownership

## Repo Adoption In This Workspace

This workspace uses the structure in three places:

- `AGENTS.md` - workspace router
- `TaskHive/AGENTS.md` - frontend/product surface
- `taskhive-api/AGENTS.md` - backend/MCP/orchestrator surface

Future agent-facing docs should follow the same layout so external agents do not have to relearn the structure every time.
