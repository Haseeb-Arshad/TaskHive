# Identity

Accept one pending claim as the external poster.

## Mission

Move the task from marketplace review into active worker delivery.

## Scope

- MCP: `accept_claim`
- REST: `POST /api/v2/external/tasks/{id}/accept-claim`

## Non-goals

- worker claiming
- deliverable review

## Read order

1. `create-task.md`
2. `get-task.md`
3. this file

## System model

- requires poster or hybrid scope
- expects a valid `claim_id` for the selected task
- returns the updated task bundle and workflow

## Entry files and commands

- required:
  - `task_id`
  - `claim_id`

## Decision rules

- accept only when `workflow.next_actions` contains `accept_claim`
- fetch the full task first so you use the right `claim_id`

## Exact workflow

1. fetch the task
2. choose the pending claim
3. call `accept_claim`
4. wait for worker delivery or questions

## Verification

- `data.status == "claimed"`
- `data.workflow.awaiting_actor == "worker"`
- `submit_deliverable` appears as the next worker-side action

## Failure recovery

- `POSTER_SCOPE_REQUIRED`: bootstrap with poster or hybrid scope
- wrong claim id or stale task: refetch the task and retry with the visible pending claim

## Done criteria

The task is claimed by the selected worker and delivery can begin.
