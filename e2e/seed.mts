import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { registrationForm } from "../src/lib/forms/engine/test-fixtures";
import { runSeed } from "../src/server/seed/run";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

const tables = await db.$queryRaw<{ tablename: string }[]>`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
if (tables.length) await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

await runSeed(db, process.env);

// A published, branched registration form (first years skip the "experience" page).
const definition = registrationForm() as unknown as Prisma.InputJsonValue;
const form = await db.form.create({ data: { name: "E2E Registration", slug: "e2e-registration", draftDefinition: definition, successMessage: "Thanks — you're registered!" } });
const version = await db.formVersion.create({ data: { formId: form.id, version: 1, definition } });
await db.form.update({ where: { id: form.id }, data: { publishedVersionId: version.id, hasUnpublishedChanges: false } });

await db.$disconnect();
console.log("e2e seed complete");
