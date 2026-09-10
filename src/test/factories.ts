import { db } from "@/lib/db";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { syncPermissions } from "@/lib/rbac/sync";

let counter = 0;

export async function createAdmin(
  opts: {
    roleKey?: string;
    permissions?: PermissionKey[];
    overrides?: { permissionKey: PermissionKey; effect: "GRANT" | "DENY" }[];
    isActive?: boolean;
  } = {},
) {
  await syncPermissions(db);
  counter += 1;
  const role = await db.role.create({
    data: {
      key: opts.roleKey ?? `role_${counter}`,
      name: `Role ${counter}`,
      permissions: { create: (opts.permissions ?? []).map((permissionKey) => ({ permissionKey })) },
    },
  });
  return db.adminUser.create({
    data: {
      email: `admin${counter}@example.test`,
      name: `Admin ${counter}`,
      passwordHash: "unused",
      roleId: role.id,
      isActive: opts.isActive ?? true,
      permissionOverrides: { create: opts.overrides ?? [] },
    },
  });
}
