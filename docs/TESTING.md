# Testing

```
npm test          # once
npm run test:watch
```

Tests run on Vitest against a **throwaway Postgres in Docker**, never the real database: they truncate every table between tests.

## First run

```
docker run -d --name dawgtreats-test \
  -e POSTGRES_PASSWORD=dawgtreats -e POSTGRES_DB=dawgtreats_test \
  -p 5433:5432 postgres:17-alpine
```

Afterwards `docker start dawgtreats-test` is enough. Migrations are applied automatically before the suite, so a fresh container needs no setup. Point the tests elsewhere with `TEST_DATABASE_URL` if you prefer another server.

## What is covered

| File | Covers |
| --- | --- |
| `tests/reservation.test.ts` | The checkout transaction against a real database: overselling, slot capacity, rollback, what an order records, and a closed shop. |
| `tests/rules.test.ts` | Money, input rules, what checkout accepts, and which weekend is next (including both daylight-saving switches). No database. |

**`tests/reservation.test.ts` contains the required concurrency test** (20 simultaneous checkouts for the last 5 cookies). CLAUDE.md says it must not be deleted. It is the proof that the business can never promise cookies it does not have.

## Writing a test

- `seedWeek({ stock, slots, capacity, status })` builds an open, orderable week; `resetDatabase()` runs before each test.
- Call the `lib/` function directly rather than the HTTP route: that is where the rules live.
- For anything about stock or slots, assert the **database state afterwards**, not just the thrown error. A refusal that quietly ate stock would still pass an error-only test.
- Prove a safety test can fail: delete the guard it protects, watch it go red, then put it back. A green test that cannot fail is worse than no test.
