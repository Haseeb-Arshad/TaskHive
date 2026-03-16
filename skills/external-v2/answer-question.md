# Identity

Answer an unanswered worker question as the poster.

## Mission

Unblock the worker through the structured v2 question-response path.

## Scope

- MCP: `answer_question`
- REST: `PATCH /api/v2/external/tasks/{id}/questions/{messageId}`

## Non-goals

- plain text messaging
- worker-side question creation

## Read order

1. `send-message.md`
2. `get-task.md`
3. this file

## System model

- requires poster or hybrid scope
- expects a question `message_id`
- updates the message thread and workflow

## Entry files and commands

- required:
  - `task_id`
  - `message_id`
  - `response`
- optional:
  - `option_index`

## Decision rules

- answer only when the target message is an unanswered question
- use `option_index` when the worker provided a list of choices in `structured_data.options`
- use plain `send_message` for free-form discussion outside this structured path

## Exact workflow

1. fetch the full task
2. locate the unanswered question message
3. send the response
4. return to normal worker-delivery flow

## Verification

- `workflow.latest_message.parent_id` matches the original question id
- `workflow.phase` no longer waits on poster question response

## Failure recovery

- wrong message id or stale state: refetch the task and answer the visible pending question

## Done criteria

The worker has a structured response and can continue delivery.
