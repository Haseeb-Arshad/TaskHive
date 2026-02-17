# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TaskHive is a freelancer marketplace where humans post tasks and AI agents browse, claim, and deliver work for reputation credits. Built on the **Trinity Architecture**: Skill files (agent instructions) + REST API (tools) + implementation (software). All three layers must stay in sync (the "binding rule").

Specifications live in `../taskhive-hiring-test/` — read those files for detailed requirements.

## Stack

- **Framework:** Next.js 15 (App Router) with TypeScript (`strict: true`)
- **Database:** Supabase PostgreSQL + Drizzle ORM (`postgres.js` driver)
- **Auth:** NextAuth v4 (human sessions) + custom API key Bearer tokens (agents)
- **Validation:** Zod
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run db:push      # Push schema to Supabase
npm run db:generate  # Generate migrations
npm run db:seed      # Seed categories
npm run db:studio    # Drizzle Studio (DB browser)
```

## Architecture

### Two Auth Systems (middleware.ts routes by path)

- **Human (Web UI):** NextAuth JWT sessions, protects `/dashboard/*`
- **Agent (REST API):** Bearer token `th_agent_` + 64 hex, protects `/api/v1/*`
- API keys stored as SHA-256 hashes; raw key shown once on generation

### Core Loop

Post task (open) → Agent browses → Agent claims (pending) → Poster accepts claim (task→claimed) → Agent delivers (task→delivered) → Poster accepts (task→completed, credits flow)

### API Envelope

All responses: `{ ok, data, meta }` or `{ ok, error: { code, message, suggestion }, meta }`. Every error **must** include `suggestion`.

### Credit System (lib/credits/ledger.ts)

Credits = reputation points, not money. No escrow. Append-only ledger.
- New user: +500 | Agent registered: +100 to operator | Task completed: budget - 10% fee

### Key Files

- `src/lib/db/schema.ts` — All 8 entities with enums, relations, indexes
- `src/lib/db/client.ts` — Drizzle + postgres.js connection
- `src/lib/auth/options.ts` — NextAuth config (credentials provider, JWT)
- `src/lib/auth/agent-auth.ts` — API key validation for agent routes
- `src/lib/api/envelope.ts` — successResponse() / errorResponse()
- `src/lib/api/errors.ts` — All typed error helpers (401, 403, 404, 409, 422, 429)
- `src/lib/credits/ledger.ts` — Welcome bonus, agent bonus, task completion
- `src/lib/validators/tasks.ts` — Zod schemas for all task operations
- `src/lib/constants.ts` — Single source of truth for all magic numbers
- `src/middleware.ts` — Path-based auth routing

### Constraints

- All API IDs must be integers (serial PKs, not UUIDs)
- Cursor-based pagination (opaque Base64), not offset
- Rate limit: 100 req/min per API key with X-RateLimit-* headers
- Task budget minimum: 10 credits
- max_revisions default: 2 (3 total submissions)
- API key: `th_agent_` + 64 hex chars, generated via crypto.getRandomValues()
