# Security audit

Slice 12. Every way a request can reach this system, what it is allowed to do, and what it
costs to abuse. Run before live mode, since that is the point where mistakes involve real
cards and real addresses.

Date: 2 October 2026. Re-run this before any release that adds a route, a page that reads a
session, or a table.

## Who is allowed

| Entry point | Caller | How it is enforced |
| --- | --- | --- |
| `GET /` `/cart` `/checkout` `/order/lookup` | anyone | Public by design; no personal data rendered |
| `POST /api/checkout` | anyone | Rate limited; account id comes from the session, never the body |
| `GET /api/orders/[code]` | anyone with a code | Rate limited; returns no contact details |
| `PATCH /api/me` | the signed-in account | `currentAccount()`; writes only to its own row |
| `GET /account` | the signed-in account | `currentAccount()`; falls back to a sign-in page |
| `GET /pickup` | an admin account | `currentAdmin()`; `notFound()` for everyone else |
| `readyAction` `pickedUpAction` `undoAction` | an admin account | Each re-checks `currentAdmin()` on every call |
| `POST /api/webhooks/stripe` | Stripe | Signature verified against `STRIPE_WEBHOOK_SECRET` |
| `GET /api/cron/sweep` | the scheduler | Bearer secret compared with `timingSafeEqual`; 404 otherwise |
| `GET /auth/callback` | Google, via Supabase | Exchanges a code; `next` must be a relative path |
| `npm run admin` | whoever holds `.env.local` | No network surface; runs on the owner's machine |

A server action is a public endpoint. `/pickup` having rendered once says nothing about who
calls its actions a minute later, so the check is inside each action rather than only on the
page.

## What leaks

- **An order code reveals no identity.** `getPublicOrder` returns cookies, pickup window,
  status and total. Never name, email or phone. A test asserts this.
- **The pickup page is the only place contact details render,** and it is admin-only.
- **Personalised pages are `force-dynamic` with `no-cache`,** so no CDN can serve one
  person's account page to the next visitor.
- **Sign-in cannot be redirected off-site:** `safeNext` accepts only paths starting with a
  single `/`.
- **`claimGuestOrders` matches on the email Google verified,** and only claims orders with
  no owner. An unverified phone number never claims anything.

## What a script can cost

| Attempt | Limit | What it costs |
| --- | --- | --- |
| Reserve cookies without paying | 5 per 10 minutes per address | Previously unlimited; a loop could hold a whole week |
| Guess order codes | 20 per minute per address | 32^8 codes; guessing is not viable at this rate |
| Everything else | unmetered | No write, no cost |

Limits key on `x-real-ip`, which Vercel sets itself. The left-most `x-forwarded-for` entry is
caller-controlled and keying on it let one caller mint a fresh identity per request.

If Upstash is unreachable the limiter lets requests through and logs
`rate_limit_unavailable`. A shop that cannot sell because a side service is down is worse
than one briefly unmetered.

## What is trusted

- **Prices, totals and stock come from the database.** The request body supplies flavour ids
  and quantities only.
- **Payment status comes from Stripe's webhook,** never the browser redirect.
- **Webhook handlers are idempotent:** deduped on `stripe_event_id`, and they act only on a
  `pending` order.
- **Every status change is a conditional update.** Reserving, paying, releasing, bagging and
  handing over all refuse to run twice.

## The database

The app connects straight to Postgres as the owner through Drizzle. It never uses Supabase's
REST API, and the browser never talks to the database.

**Finding, fixed 2 October 2026.** The `anon` and `authenticated` roles held
`SELECT, INSERT, UPDATE, DELETE, TRUNCATE` on all nine tables — Supabase's default grant. The
anon key ships in every browser, so the only thing standing between it and the orders table
was RLS being enabled with no policies. That is one dashboard toggle away from exposing
customer names, emails, phone numbers and order history, and `TRUNCATE` is not subject to RLS
at all.

Fixed by revoking every privilege on tables, sequences and functions in `public` from both
roles, and revoking the same from default privileges so new tables do not reinstate it.
`service_role` is untouched. Verified afterwards: zero remaining grants, and the live site
still reads and writes normally.

RLS stays on with no policies as a second layer. Neither is now load-bearing alone.

**If the browser ever needs to query Supabase directly,** these grants have to be restored
deliberately, with RLS policies written first. Do not re-grant to get something working.

## Still open

- **PostgREST is returning 503** (`no exposed schemas`). Harmless today — it is the API we do
  not use — but it means the REST layer is misconfigured rather than deliberately disabled.
- **No alerting on the rate limiter.** `rate_limit_unavailable` reaches Sentry only if it
  throws; a sustained outage is currently silent.
- **The admin CLI has no audit trail.** Whoever holds `.env.local` can change any week or
  flavour, and nothing records that it happened. Acceptable for one owner.
