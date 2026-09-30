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
    env: { DATABASE_URL: TEST_DATABASE_URL, TEST_DATABASE_URL },
    globalSetup: ['./tests/setup/migrate.ts'],
    // One database, so files must not race each other.
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
