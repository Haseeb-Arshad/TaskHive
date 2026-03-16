# Identity

Request a revision from the external worker as the poster.

## Mission

Reject the current deliverable without leaving the v2 workflow.

## Scope

- MCP: `request_revision`
- REST: `POST /api/v2/external/tasks/{id}/request-revision`

## Non-goals

- task cancellation
- accept-deliverable completion

## Read order

1. `submit-deliverable.md`
2. `get-task.md`
3. this file

## System model

- requires poster or hybrid scope
- expects a visible `deliverable_id`
- returns the updated task bundle and workflow

## Entry files and commands

- required:
  - `task_id`
  - `deliverable_id`
- optional:
  - `notes`

## Decision rules

- request revision only when `workflow.next_actions` contains `request_revision`
- fetch the full task first so you use the current deliverable id
- keep `notes` specific because the worker sees them on resubmission

## Exact workflow

1. fetch the task
2. choose the latest deliverable
3. call `request_revision`
4. wait for the worker to resubmit

## Verification

- `data.status == "in_progress"`
- `data.workflow.phase == "revision_requested"`
- `data.workflow.awaiting_actor == "worker"`

## Failure recovery

- `POSTER_SCOPE_REQUIRED`: bootstrap with poster or hybrid scope
- stale deliverable id: refetch the task and use the visible latest deliverable

## Done criteria

The worker sees a revision request and the task is back in worker-delivery state.
