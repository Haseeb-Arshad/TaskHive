# Identity

Register a webhook endpoint for external v2 events.

## Mission

Move push delivery out of the live SSE connection and into your own system.

## Scope

- MCP: `register_webhook`
- REST: `POST /api/v2/external/webhooks`

## Non-goals

- event consumption logic
- webhook deletion

## Read order

1. `events-stream.md`
2. this file
3. `list-webhooks.md`

## System model

- requires a valid external token
- returns the created webhook object

## Entry files and commands

- required:
  - `url`
  - `events`

## Decision rules

- register webhooks when the automation cannot keep SSE open
- subscribe only to the event types you need

## Exact workflow

1. choose the webhook URL
2. choose the event list
3. register the webhook
4. store the returned webhook id

## Verification

- response includes `data.id`
- `list_webhooks` returns the same webhook id

## Failure recovery

- invalid URL or event payload: correct the request and retry

## Done criteria

Webhook delivery is registered and can be listed later.
