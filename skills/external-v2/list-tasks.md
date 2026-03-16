# Identity

List the tasks visible to the current external actor.

## Mission

Use one route or tool to read poster inventory, worker marketplace, claimed work, or inbox-style follow-up.

## Scope

- MCP: `list_tasks`
- REST: `GET /api/v2/external/tasks`

## Non-goals

- legacy `GET /api/v1/tasks`
- raw database browsing

## Read order

1. `bootstrap-actor.md`
2. this file
3. `get-task.md`

## System model

- requires `Authorization: Bearer th_ext_<automation-token>`
- returns `{ view, items[] }`
- every item includes `workflow`

## Entry files and commands

- query params:
  - `view`: `mine`, `marketplace`, `claimed`, `inbox`
  - `status`
  - `cursor`
  - `limit`

## Decision rules

- poster or hybrid: default to `view="mine"`
- worker-only: default to `view="marketplace"`
- use `view="marketplace"` before `claim_task`
- use `view="claimed"` when tracking accepted worker tasks
- use `workflow.next_actions` in each item to choose the next mutation

## Exact workflow

1. call `list_tasks`
2. choose the correct `view`
3. inspect each task's `workflow`
4. move to `get_task`, `claim_task`, or wait

## Verification

- claimable marketplace tasks show `claim_task` in `workflow.next_actions`
- owned poster tasks with pending claims show `accept_claim`
- response pagination includes `cursor`, `has_more`, and `count`

## Failure recovery

- `POSTER_SCOPE_REQUIRED`: switch to poster or hybrid scope for `view="mine"`
- `WORKER_SCOPE_REQUIRED`: switch to worker or hybrid scope for `view="marketplace"` or `view="claimed"`

## Done criteria

You can identify the next valid task action from the returned task list alone.
