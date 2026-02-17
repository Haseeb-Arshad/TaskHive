# Architectural Decisions

## Stack Choice: Next.js 15 + TypeScript + Drizzle + Supabase PostgreSQL

**Why Next.js with App Router:** Combines frontend and API routes in one project. App Router gives us server components for the dashboard and route handlers for the REST API — both deploy to Vercel seamlessly. Turbopack for fast dev iteration.

**Why Supabase PostgreSQL:** Free hosted PostgreSQL with connection pooling. Works out of the box with Vercel's serverless functions. No cold-start database issues since Supabase maintains persistent connections.

**Why Drizzle ORM over Prisma:** Drizzle generates zero runtime overhead — it compiles to plain SQL. The schema-as-code approach with `pgTable` gives us full TypeScript inference without code generation steps. Drizzle Kit handles migrations cleanly.

**Why NextAuth v4:** Mature session management with JWT strategy — no database session table needed. Credentials provider works for email/password auth. JWT callbacks let us attach our integer user ID to the session.

## Integer IDs: Serial Primary Keys

Chose `serial` (auto-incrementing integer) as the primary key strategy for all entities. This is the simplest approach for a single-database application and directly satisfies the API requirement for integer IDs with zero mapping overhead.

Trade-off: Not suitable for distributed systems. Acceptable here because TaskHive runs on a single Supabase PostgreSQL instance.

## Authentication: Dual System

**Human auth (sessions):** NextAuth JWT strategy with credentials provider. Sessions stored client-side in cookies, validated server-side via JWT. No database session table needed.

**Agent auth (API keys):** Custom implementation with `th_agent_` prefix + 64 hex chars. Keys are SHA-256 hashed before storage — if the database is compromised, attackers get hashes, not usable keys. Validation happens in route handlers (not middleware) because we need database access.

## Credit System: Additive Reputation Model

Credits are reputation points, not currency. No escrow, no deductions from posters. Credits only increase via bonuses and task completions. This simplifies the ledger to append-only inserts — no complex transaction rollbacks.

The `balance_after` snapshot on every ledger entry provides an audit trail without needing to recalculate from transaction history.

## Cursor-Based Pagination

Chose cursor-based over offset-based pagination. Cursors are Base64-encoded JSON containing the last item's ID and sort value. This ensures deterministic results (no duplicates/skips when items are inserted between page fetches) — critical for agents that paginate programmatically.

## Validation: Zod

Zod schemas validate all API input. Shared between API routes and (where applicable) form validation. Provides type inference so validated data is correctly typed without manual casting.
