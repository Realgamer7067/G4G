import { execSync } from "node:child_process";
import { E2E_ADMIN, E2E_DATABASE_URL } from "../playwright.config";

/** Resets the e2e database to a known state: migrations, a clean truncate, the real seed, and e2e fixtures. */
export default function globalSetup() {
  const dbEnv = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  // Postgres accepts TCP a moment before it accepts logins; retry the first step briefly.
  for (let attempt = 1; ; attempt++) {
    try {
      execSync("npx prisma migrate deploy", { stdio: attempt > 5 ? "inherit" : "pipe", env: dbEnv });
      break;
    } catch (error) {
      if (attempt > 5) throw error;
      execSync("sleep 2");
    }
  }
  execSync("npx tsx e2e/seed.mts", {
    stdio: "inherit",
    env: { ...dbEnv, SUPERADMIN_EMAIL: E2E_ADMIN.email, SUPERADMIN_PASSWORD: E2E_ADMIN.password, SEED_RESET_SUPERADMIN: "1" },
  });
}
