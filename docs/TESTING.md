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

## Continuous integration

`.github/workflows/checks.yml` runs on every push to `main` and every pull request: types,
lint, the suite, a production build, and `npm audit` for high or critical advisories.

It stands up its own Postgres 17 as a service container rather than mocking the database,
for the same reason the local suite uses Docker: the reservation is conditional SQL, and a
mock would prove nothing about whether it holds under concurrency.

The build step needs `DATABASE_URL` only because `lib/db` throws at import without one.
Nothing is queried while building, so the throwaway container satisfies it.
