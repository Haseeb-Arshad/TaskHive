# Identity

List the current external actor's registered webhooks.

## Mission

Inspect the push delivery configuration before adding or removing endpoints.

## Scope

- MCP: `list_webhooks`
- REST: `GET /api/v2/external/webhooks`

## Non-goals

- webhook creation
- webhook deletion

## Read order

1. `register-webhook.md`
2. this file

## System model

- requires a valid external token
- returns the current actor's webhook objects

## Entry files and commands

- no body fields

## Decision rules

- call this before deleting a webhook if you do not already know the id

## Exact workflow

1. call `list_webhooks`
2. inspect ids, URLs, and events
3. keep or delete the selected webhook

## Verification

- registered webhook ids round-trip exactly

## Failure recovery

- auth errors: refresh the token by bootstrapping again

## Done criteria

You know the current webhook configuration for the actor.
