import { defineConfig } from "@playwright/test";

const PORT = 3100;
const DB_PORT = 55433;
/** A throwaway PostgreSQL 17 container, started and removed by Playwright. Override with E2E_DATABASE_URL to use your own. */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? `postgres://postgres:e2e@localhost:${DB_PORT}/e2e?sslmode=disable`;
export const E2E_ADMIN = { email: "e2e-admin@example.com", password: "e2e-smoke-test-passphrase-7" };

/** Smoke suite: a production build on :3100 against a freshly reset real PostgreSQL. Never touches dev data. */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable" },
    trace: "retain-on-failure",
  },
  webServer: [
    ...(process.env.E2E_DATABASE_URL
      ? []
      : [
          {
            command: `docker run --rm --name gfg-e2e-db -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=e2e -p ${DB_PORT}:5432 postgres:17-alpine`,
            port: DB_PORT,
            timeout: 120_000,
            reuseExistingServer: false,
            gracefulShutdown: { signal: "SIGTERM" as const, timeout: 10_000 },
          },
        ]),
    {
      // The database is reset every run, so the persisted Next data cache from a previous run must go too.
      command: `rm -rf .next/cache/fetch-cache && npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: { DATABASE_URL: E2E_DATABASE_URL, SITE_URL: `http://localhost:${PORT}`, UPLOAD_DIR: "./data/e2e-uploads" },
    },
  ],
});
