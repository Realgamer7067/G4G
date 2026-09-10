import { execSync } from "node:child_process";
import { loadEnv } from "vite";

export default function setup() {
  const env = loadEnv("test", process.cwd(), "");
  // Point the Prisma CLI at the test database; dotenv in prisma.config.ts never overrides an existing variable.
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: env.TEST_DATABASE_URL },
  });
}
