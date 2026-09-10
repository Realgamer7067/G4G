import type { PrismaClient } from "@/generated/prisma/client";
import { ALL_PERMISSION_KEYS, PERMISSIONS } from "./permissions";
import { ROLE_PRESETS } from "./roles";

/** Make the Permission table match the code catalogue exactly. */
export async function syncPermissions(db: PrismaClient): Promise<void> {
  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, group: p.group, description: p.description },
      update: { group: p.group, description: p.description },
    });
  }
  await db.permission.deleteMany({ where: { key: { notIn: [...ALL_PERMISSION_KEYS] } } });
}

/** Create missing preset roles. Existing non-system roles are left alone so admin edits survive re-seeding. */
export async function ensureRolePresets(db: PrismaClient): Promise<void> {
  for (const preset of ROLE_PRESETS) {
    const existing = await db.role.findUnique({ where: { key: preset.key } });
    if (existing) {
      if (preset.isSystem) {
        await db.role.update({
          where: { id: existing.id },
          data: { name: preset.name, description: preset.description, isSystem: true },
        });
      }
      continue;
    }
    await db.role.create({
      data: {
        key: preset.key,
        name: preset.name,
        description: preset.description,
        isSystem: preset.isSystem,
        permissions: {
          create: preset.permissions === "*" ? [] : preset.permissions.map((permissionKey) => ({ permissionKey })),
        },
      },
    });
  }
}
