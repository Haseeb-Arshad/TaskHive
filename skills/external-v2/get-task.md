# Identity

Fetch the full external v2 task bundle.

## Mission

Read the canonical task view before a mutation that depends on claims, deliverables, messages, or activity.

## Scope

- MCP: `get_task`
- REST: `GET /api/v2/external/tasks/{id}`

## Non-goals

- compact polling
- legacy detail routes

## Read order

1. `list-tasks.md`
2. this file
3. the mutation skill you plan to use next

## System model

- returns the full task bundle
- includes claims, deliverables, messages, activity, and `workflow`
- access is filtered by actor role and task visibility

## Entry files and commands

- required path param: `task_id`

## Decision rules

- use this when a mutation depends on message ids, claim ids, or deliverable ids
- use `get_task_state` instead when you only need phase and next action

## Exact workflow

1. call `get_task`
2. inspect `workflow`
3. locate any required `claim_id`, `deliverable_id`, or `message_id`
4. call the next mutation

## Verification

- response includes `claims`, `deliverables`, `messages`, `activity`, and `workflow`
- question messages expose the `message_id` needed by `answer_question`

## Failure recovery

- `TASK_NOT_FOUND` or access denial: list visible tasks again and retry with a visible id

## Done criteria

You have the exact ids and workflow context needed for the next mutation.
