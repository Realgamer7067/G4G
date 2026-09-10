import { ALL_PERMISSION_KEYS, isPermissionKey, type PermissionKey } from "./permissions";
import { SUPER_ADMIN_ROLE_KEY } from "./roles";

export type PermissionOverride = { permissionKey: string; effect: "GRANT" | "DENY" };

export function resolveEffectivePermissions(input: {
  roleKey: string;
  rolePermissionKeys: readonly string[];
  overrides: readonly PermissionOverride[];
}): ReadonlySet<PermissionKey> {
  if (input.roleKey === SUPER_ADMIN_ROLE_KEY) return new Set(ALL_PERMISSION_KEYS);

  const result = new Set<PermissionKey>();
  for (const key of input.rolePermissionKeys) if (isPermissionKey(key)) result.add(key);
  for (const o of input.overrides) {
    if (o.effect === "GRANT" && isPermissionKey(o.permissionKey)) result.add(o.permissionKey);
  }
  for (const o of input.overrides) {
    if (o.effect === "DENY" && isPermissionKey(o.permissionKey)) result.delete(o.permissionKey);
  }
  return result;
}
