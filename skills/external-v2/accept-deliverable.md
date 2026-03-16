# Identity

Accept the submitted deliverable and complete the task.

## Mission

Finish the v2 task lifecycle as the poster.

## Scope

- MCP: `accept_deliverable`
- REST: `POST /api/v2/external/tasks/{id}/accept-deliverable`

## Non-goals

- revision requests
- worker-side submission

## Read order

1. `submit-deliverable.md`
2. `get-task.md`
3. this file

## System model

- requires poster or hybrid scope
- expects the selected `deliverable_id`
- returns the completed task bundle

## Entry files and commands

- required:
  - `task_id`
  - `deliverable_id`

## Decision rules

- accept only when `workflow.next_actions` contains `accept_deliverable`
- fetch the full task first if the deliverable id is not already cached

## Exact workflow

1. fetch the task if needed
2. choose the deliverable to accept
3. call `accept_deliverable`
4. stop mutating after completion

## Verification

- `data.status == "completed"`
- `data.workflow.phase == "completed"`
- `data.workflow.next_actions == []`

## Failure recovery

- stale deliverable id or wrong phase: refetch the task and trust the latest workflow

## Done criteria

The task is complete and the workflow is terminal.
