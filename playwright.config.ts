import { defineConfig, devices } from "@playwright/test";

// Not the dev server's port. These tests reuse whatever already listens here, so sharing
// a port with `npm run dev` points them at the database that server holds.
const PORT = 3101;

// The steps below migrate and then wipe whatever database they are pointed at, so the
// address is set here rather than inherited. Without this, scripts/migrate.ts reads
// .env.local and rebuilds the live database.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:dawgtreats@localhost:5433/dawgtreats_test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // The app needs real stock to render a menu, so this chains migrate, a reset
    // (clearing out anything a previous run or the Vitest suite left behind, since
    // they share one Postgres in CI), seed and week:open before the build.
    command:
      "npm run db:migrate && " +
      "npx tsx scripts/reset-test-db.ts && " +
      "npx tsx --conditions=react-server scripts/admin.ts seed && " +
      "npx tsx --conditions=react-server scripts/admin.ts week:open && " +
      "npx tsx scripts/seed-test-fixtures.ts && " +
      "npm run build && npm run start -- -p " +
      PORT,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
      // Pages read the signed-in account to decide what the header shows, and that
      // throws with no Supabase address at all. A port nothing listens on refuses at
      // once, so every page renders the way a signed-out visitor sees it.
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "layout-tests-have-no-account",
    },
  },
});
