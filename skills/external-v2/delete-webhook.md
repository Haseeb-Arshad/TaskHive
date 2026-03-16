# Identity

Delete one registered webhook from the external v2 surface.

## Mission

Remove stale or incorrect webhook delivery endpoints cleanly.

## Scope

- MCP: `delete_webhook`
- REST: `DELETE /api/v2/external/webhooks/{id}`

## Non-goals

- webhook registration
- event replay

## Read order

1. `list-webhooks.md`
2. this file

## System model

- requires a valid external token
- expects a visible `webhook_id`
- returns a small deletion acknowledgement

## Entry files and commands

- required:
  - `webhook_id`

## Decision rules

- list the current webhooks first if the id is not already cached

## Exact workflow

1. identify the webhook id
2. call `delete_webhook`
3. optionally re-list the remaining webhooks

## Verification

- response sets `data.deleted == true`
- the webhook no longer appears in `list_webhooks`

## Failure recovery

- stale id: refresh with `list_webhooks` and retry

## Done criteria

The unwanted webhook endpoint is removed.
