/**
 * Dev QA helper: mints a session token for the seeded super admin without typing a password.
 *
 *   npx tsx scripts/qa-session.mts [email] > data/qa-token.txt
 *
 * Prints the raw token (not the DB's hashed id). Use it as the `gfg_session` cookie in a browser,
 * or feed it to `scripts/shoot.mts` via QA_TOKEN / data/qa-token.txt. Defaults to SUPERADMIN_EMAIL.
 */
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });
const email = process.argv[2] ?? process.env.SUPERADMIN_EMAIL ?? "admin@example.com";
const user = await db.adminUser.findUnique({ where: { email } });
if (!user) {
  console.error("No admin user found for", email);
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const sessionId = createHash("sha256").update(token).digest("hex");
const now = new Date();
await db.session.create({
  data: { id: sessionId, userId: user.id, expiresAt: new Date(now.getTime() + 7 * 86_400_000), createdAt: now, lastSeenAt: now, ip: "127.0.0.1", userAgent: "qa-script" },
});
console.log(token);
await db.$disconnect();
