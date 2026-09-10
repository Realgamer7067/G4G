import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

const env = loadEnv("test", process.cwd(), "");
if (!env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    setupFiles: ["src/test/int-setup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: env.TEST_DATABASE_URL, NODE_ENV: "test" },
  },
});
