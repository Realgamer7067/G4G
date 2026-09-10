import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma's env() helper throws on every CLI call when unset (even `prisma dev ls`).
    url: process.env.DATABASE_URL ?? "",
  },
});
