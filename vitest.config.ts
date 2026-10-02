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
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      TEST_DATABASE_URL,
      // Fake Stripe credentials: signatures are made and checked locally, nothing is sent.
      STRIPE_SECRET_KEY: 'sk_test_not_a_real_key',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    },
    globalSetup: ['./tests/setup/migrate.ts'],
    // One database, so files must not race each other.
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
