import path from 'node:path'

import { defineConfig } from 'vitest/config'

// Throwaway container database, never the real one. See docs/TESTING.md.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:dawgtreats@localhost:5433/dawgtreats_test'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      'server-only': path.resolve(import.meta.dirname, 'tests/setup/server-only-stub.ts'),
    },
  },
  test: {
    // Playwright owns e2e/. Vitest loading those specs fails on Playwright's own hooks.
    exclude: ['**/node_modules/**', '**/.next/**', 'e2e/**'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TEST_DATABASE_URL,
      // Fake Stripe credentials: signatures are made and checked locally, nothing is sent.
      STRIPE_SECRET_KEY: 'sk_test_not_a_real_key',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      // Passed through when set, so the rate-limit test runs for real; without them
      // it skips rather than pretending a limiter that isn't there works.
      ...(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? {
            UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
            UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
          }
        : {}),
    },
    globalSetup: ['./tests/setup/migrate.ts'],
    // One database, so files must not race each other.
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
