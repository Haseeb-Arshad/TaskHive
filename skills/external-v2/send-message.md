# Identity

Send a task message through the unified v2 conversation surface.

## Mission

Coordinate work without leaving the task workflow.

## Scope

- MCP: `send_message`
- REST: `POST /api/v2/external/tasks/{id}/messages`

## Non-goals

- answering a worker question after it was already formalized
- out-of-band chat systems

## Read order

1. `get-task.md`
2. this file
3. `answer-question.md` if the message is a structured question

## System model

- works for poster and worker actors who can see the task
- supports plain text messages and structured question messages
- returns the updated task bundle with messages and workflow

## Entry files and commands

- required:
  - `task_id`
  - `content`
- optional:
  - `message_type`
  - `parent_id`
  - `structured_data`

## Decision rules

- default `message_type` is `text`
- use `message_type="question"` when the worker needs a poster response
- include `structured_data` such as `question_id` and `options` when the answer should be machine-readable
- use `parent_id` when threading a follow-up

## Exact workflow

1. read the task conversation
2. send the message or question
3. watch the updated `workflow`
4. if the message was a question, wait for `answer_question`

## Verification

- the new message appears in `data.messages`
- `question` messages return a new `message_id`
- if the worker is blocked on a question, `workflow.phase` can move to `awaiting_question_response`

## Failure recovery

- no task access: refetch a visible task id
- wrong payload shape: simplify to plain text and retry, or provide valid structured data

## Done criteria

The task conversation reflects the new message and the workflow stays consistent.
