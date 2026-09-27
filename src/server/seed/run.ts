import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/roles";
import { ensureRolePresets, syncPermissions } from "@/lib/rbac/sync";
import { homepageTemplate } from "@/lib/homepage/template";
import { slugify } from "@/lib/utils/slug";
import { CATEGORY_DEFAULTS, DOMAIN_DEFAULTS, PAGE_DEFAULTS, SITE_DEFAULTS } from "./defaults";

export async function runSeed(db: PrismaClient, env: NodeJS.ProcessEnv): Promise<void> {
  await syncPermissions(db);
  await ensureRolePresets(db);
  await seedSuperAdmin(db, env);

  await db.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...SITE_DEFAULTS }, update: {} });

  for (const page of PAGE_DEFAULTS) {
    await db.pageSetting.upsert({ where: { key: page.key }, create: page, update: {} });
  }
  for (const [order, name] of DOMAIN_DEFAULTS.entries()) {
    const slug = slugify(name.replace("/", " "));
    await db.domain.upsert({ where: { slug }, create: { name, slug, order }, update: {} });
  }
  for (const [order, name] of CATEGORY_DEFAULTS.entries()) {
    const slug = slugify(name);
    await db.eventCategory.upsert({ where: { slug }, create: { name, slug, order }, update: {} });
  }

  // Fresh installs get the recommended homepage as a DRAFT to review in the builder. Never auto-published.
  if ((await db.homepageRevision.count()) === 0) {
    await db.homepageRevision.create({ data: { status: "DRAFT", sections: homepageTemplate({ reviewNote: true }) } });
  }
}

async function seedSuperAdmin(db: PrismaClient, env: NodeJS.ProcessEnv): Promise<void> {
  const email = env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping super admin.");
    return;
  }
  const problem = passwordProblem(password);
  if (problem) throw new Error(`SUPERADMIN_PASSWORD: ${problem}`);

  const role = await db.role.findUniqueOrThrow({ where: { key: SUPER_ADMIN_ROLE_KEY } });
  const existing = await db.adminUser.findUnique({ where: { email } });
  if (!existing) {
    await db.adminUser.create({
      data: { email, name: "Super Admin", passwordHash: await hashPassword(password), roleId: role.id },
    });
    console.log(`Created super admin ${email}`);
  } else if (env.SEED_RESET_SUPERADMIN === "1") {
    await db.adminUser.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password), roleId: role.id, isActive: true },
    });
    await db.session.deleteMany({ where: { userId: existing.id } });
    console.log(`Reset super admin ${email}`);
  }
}
