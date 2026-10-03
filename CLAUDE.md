# Dawg Treats

Order site for a dorm cookie business: weekly batches, weekend pickup, ~50-150 cookies/week.
Full design in `docs/SYSTEM_DESIGN.MD`. Read it before any architectural change.

## Stack

Next.js (App Router) · Supabase Postgres · Drizzle · Stripe Checkout · Supabase Auth (Google only) · Resend · Vercel · Sentry

## Commands

```
npm run dev
npm run admin -- help  # admin CLI: weeks, quantities, slots, flavors
npm run db:generate    # generate migration from schema
npm run db:migrate
npm test               # needs the test database; see docs/TESTING.md
npm run lint
```

## Architecture rules

- Monolith, organized as modules under `lib/`: `inventory`, `orders`, `payments`, `weeks`, `flavors`, `email`, `auth`, `feedback`, `limits`. Shared: `lib/errors.ts` and `lib/money.ts` (client-safe).
- API routes stay thin: parse → authorize → call `lib/` → respond. No SQL in routes.
- All stock and slot changes go through `lib/inventory`. Never inline.
- Server-only modules start with `import 'server-only'`.
- Public routes under `/api/`. Admin work runs through the CLI (`scripts/admin.ts`, `npm run admin`), which calls `lib/` directly and so obeys the same rules. The one exception is `/pickup`, the pickup-day screen: it is gated on `currentAdmin()`, 404s for everyone else, and mutates through server actions that re-check the admin on every call, so there are still no admin API routes.
- Expected failures throw `DomainError` from `lib/`; routes return them with `errorResponse`, so the user sees the specific message.

## Correctness rules

- Money is integer cents. Never floats.
- Never trust prices, quantities, or totals from the request body. Read them from the database.
- The checkout reservation is one transaction with conditional updates. It must be impossible to oversell a flavor or overbook a slot.
- Stripe webhooks are the source of truth for payment. The browser redirect never marks an order paid.
- Webhook handlers are idempotent: dedupe on `stripe_event_id`, and only act on `pending` orders.
- Timestamps stored in UTC. Pickup times render in PT with the zone shown.
- Order codes are random and non-sequential.

## Code style

- TypeScript strict. No `any`.
- Named exports. No default exports except pages.
- Validate request bodies with Zod at the route boundary, and CLI arguments the same way. Input rules follow `docs/INPUTS.md`; rules and messages live in `lib/validation.ts`, shared by the browser, the API and the CLI.
- Colours use role tokens only (`text-secondary`, `bg-surface`, `border-error`), named by job, never by hue. Spacing, sizes and radii come from the fixed scale (`p-4`, `h-control`, `rounded-card`); values off it don't compile. No hex, `rgb()` or arbitrary values in components. See `docs/TOKENS.md`.
- The name is **Dawg Treats** wherever a person reads it (titles, headings, emails, CLI output) and **dawgtreats** wherever a machine does (package, repo, domain, containers, storage keys). Never `Dawgtreats` or `DawgTreats`.
- Return specific, actionable errors ("snickerdoodle sold out"), not generic 500s.
- Never swallow errors. Log with context.

## Comments

- Comment why, never what. If the code needs a comment to say what it does, rename things instead.
- Two lines maximum. Longer than that means the explanation belongs in `docs/`.
- Comment the non-obvious: pooler quirks, Stripe timing, anything that looks wrong but is deliberate.
- No section banners, no JSDoc on internal functions, no commented-out code.

## Testing

- Tests cover `lib/` logic, especially the reservation. Vitest, against a throwaway Postgres in Docker: `docs/TESTING.md`.
- The concurrency test (20 simultaneous checkouts against the last 5 cookies, asserting no overselling) is required and must not be deleted.
- Assert the database state after a refusal, not just the error: a rollback that silently ate stock still throws.

## Don't

- Add dependencies without asking.
- Refactor files unrelated to the current task.
- Change the schema without updating `docs/SYSTEM_DESIGN.MD`.
- Create a new file for a single small function. Add it to the existing `lib/` module.
- Add abstraction layers, wrappers, or interfaces with one implementation.
- Generate READMEs, docs, or comments unless asked.
- Add config files, scripts, or tooling that weren't requested.
- Commit `.env*` or any secret.

**Prefer editing an existing file over creating a new one. If a new file is needed, say why before creating it.**

## Secrets

Server-only env vars: `DATABASE_URL`, `DIRECT_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`.
`DIRECT_URL` is the unpooled connection, used only by migrations (`scripts/migrate.ts`).
Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
`TEST_DATABASE_URL` is local/test-only, read by Vitest (`tests/setup/migrate.ts`, `vitest.config.ts`); never a Vercel secret.
Never add `NEXT_PUBLIC_` to anything else.

## Workflow

Work one slice at a time from the build plan in `docs/SYSTEM_DESIGN.MD`. Each slice ends with something that runs, plus a commit.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
