import { SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/roles";

type Actor = { id: string; roleKey: string };
type Target = { id: string; roleKey: string; isActive: boolean };

export type AdminChange =
  | { kind: "role"; newRoleKey: string }
  | { kind: "deactivate" }
  | { kind: "activate" }
  | { kind: "overrides" };

export function canAssignRole(actor: Pick<Actor, "roleKey">, roleKey: string): boolean {
  return roleKey !== SUPER_ADMIN_ROLE_KEY || actor.roleKey === SUPER_ADMIN_ROLE_KEY;
}

/** Returns why an admin may not make this change to another admin, or null when allowed. */
export function adminChangeProblem(input: {
  actor: Actor;
  target: Target;
  activeSuperAdmins: number;
  change: AdminChange;
}): string | null {
  const { actor, target, activeSuperAdmins, change } = input;
  if (actor.id === target.id) return "You can't change your own access. Ask another admin.";

  const targetIsSuper = target.roleKey === SUPER_ADMIN_ROLE_KEY;
  if (targetIsSuper && actor.roleKey !== SUPER_ADMIN_ROLE_KEY) return "Only a super admin can change another super admin.";
  if (change.kind === "role" && !canAssignRole(actor, change.newRoleKey)) return "Only a super admin can grant Super Admin.";
  if (change.kind === "overrides" && targetIsSuper) return "Super admins always have every permission.";

  const removesSuperAdmin =
    targetIsSuper &&
    target.isActive &&
    (change.kind === "deactivate" || (change.kind === "role" && change.newRoleKey !== SUPER_ADMIN_ROLE_KEY));
  if (removesSuperAdmin && activeSuperAdmins <= 1) return "Keep at least one active super admin.";

  return null;
}

/**
 * Privilege escalation guard: a non-super admin may only hand out permissions they hold themselves.
 * Returns the requested keys the actor lacks (always empty for super admins).
 */
export function permissionsBeyondActor(
  actor: { roleKey: string; permissions: ReadonlySet<string> },
  requested: Iterable<string>,
): string[] {
  if (actor.roleKey === SUPER_ADMIN_ROLE_KEY) return [];
  return [...new Set(requested)].filter((key) => !actor.permissions.has(key)).sort();
}

export function beyondActorMessage(missing: readonly string[]): string {
  return `You can only grant permissions you have yourself. Not allowed: ${missing.join(", ")}.`;
}

export function roleDeleteProblem(role: { isSystem: boolean; memberCount: number; pendingInvites: number }): string | null {
  if (role.isSystem) return "The Super Admin role can't be deleted.";
  if (role.memberCount > 0) {
    return `Move its ${role.memberCount} member${role.memberCount === 1 ? "" : "s"} to another role first.`;
  }
  if (role.pendingInvites > 0) return "Revoke its pending invites first.";
  return null;
}
