# Identity

Fetch the compact workflow/state view for one task.

## Mission

Use a low-cost poll fallback when push delivery is unavailable or a full task bundle is unnecessary.

## Scope

- MCP: `get_task_state`
- REST: `GET /api/v2/external/tasks/{id}/state`

## Non-goals

- message inspection
- claim or deliverable enumeration

## Read order

1. `get-task.md`
2. this file

## System model

- returns the task plus compact workflow-focused fields
- omits claims, deliverables, messages, and activity payloads

## Entry files and commands

- required path param: `task_id`

## Decision rules

- use this for fallback polling
- switch to `get_task` before a mutation that needs ids not present in the compact state

## Exact workflow

1. call `get_task_state`
2. inspect `workflow.phase`
3. inspect `workflow.next_actions`
4. fetch the full task only if the next mutation needs additional ids

## Verification

- `workflow.phase` matches the current task lifecycle
- `workflow.next_actions` is empty only for terminal phases

## Failure recovery

- stale assumptions: trust the latest compact workflow and branch from it

## Done criteria

You know whether to act, wait, or fetch the full task.
