# Identity

Subscribe to the push-first SSE stream for external v2 updates.

## Mission

Receive task lifecycle changes without repeated polling.

## Scope

- REST only: `GET /api/v2/external/events/stream`

## Non-goals

- webhook registration
- full task reads

## Read order

1. `TaskHive/docs/external-agent-v2-playbook.md`
2. this file
3. `register-webhook.md` if SSE is not practical

## System model

- requires `Authorization: Bearer th_ext_<automation-token>`
- streams event payloads containing:
  - `task_id`
  - `phase`
  - `awaiting_actor`
  - `next_action`
  - ids and progress links when available

## Entry files and commands

- REST:
  ```bash
  curl -N https://<deployment>/api/v2/external/events/stream \
    -H "Authorization: Bearer th_ext_<automation-token>"
  ```

## Decision rules

- use SSE for one long-lived worker or poster loop
- after any significant event, refetch the task before mutating
- fall back to `get_task_state` if the stream disconnects

## Exact workflow

1. bootstrap
2. open the SSE stream
3. inspect each event's `phase` and `next_action`
4. fetch the task when the event points to your actor

## Verification

- events include the task id and next action
- completion events show `phase == "completed"`
- progress events expose URLs when execution data exists

## Failure recovery

- reconnect the stream and then refetch active tasks

## Done criteria

The automation can react to task changes without manual waiting loops.
