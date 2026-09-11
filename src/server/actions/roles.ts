"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { beyondActorMessage, permissionsBeyondActor, roleDeleteProblem } from "@/lib/admin/policies";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ForbiddenError, UserError } from "@/lib/errors";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "@/lib/rbac/permissions";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/roles";
import { getRequestMeta } from "@/lib/request-meta";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

const roleSchema = z.object({
  name: z.string().trim().min(2, "Give the role a name.").max(40, "Keep it under 40 characters."),
  description: z.string().trim().max(200, "Keep it under 200 characters.").default(""),
  permissions: z.array(z.enum(ALL_PERMISSION_KEYS as [PermissionKey, ...PermissionKey[]])).default([]),
});

function parseRole(formData: FormData) {
  return roleSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    permissions: formData.getAll("permissions").map(String),
  });
}

function assertCanHandOut(user: SessionUser, permissions: readonly string[]) {
  const missing = permissionsBeyondActor(user, permissions);
  if (missing.length) throw new ForbiddenError(beyondActorMessage(missing));
}

export async function createRoleAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("roles.manage");
    const input = parseRole(formData);
    assertCanHandOut(user, input.permissions);
    const base = slugify(input.name).replace(/-/g, "_") || "role";
    const key = await uniqueSlug(base === SUPER_ADMIN_ROLE_KEY ? "custom_super_admin" : base, async (k) =>
      Boolean(await db.role.findUnique({ where: { key: k } })),
    );
    const meta = await getRequestMeta();
    return db.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          key,
          name: input.name,
          description: input.description,
          permissions: { create: input.permissions.map((permissionKey) => ({ permissionKey })) },
        },
      });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "role.created",
        target: { type: "Role", id: role.id, label: role.name },
        metadata: { permissions: input.permissions },
        meta,
      });
      return role.id;
    });
  });
  if (result.ok) redirect(`/admin/roles/${result.data}?created=1`);
  return result as ActionResult;
}

export async function updateRoleAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("roles.manage");
    const roleId = String(formData.get("roleId") ?? "");
    const role = await db.role.findUnique({ where: { id: roleId }, include: { permissions: true } });
    if (!role) throw new UserError("That role no longer exists.");
    if (role.isSystem) throw new UserError("The Super Admin role always has every permission and can't be edited.");
    if (user.roleKey !== SUPER_ADMIN_ROLE_KEY && role.id === user.roleId) {
      throw new UserError("You can't change your own role. Ask a super admin.");
    }
    const input = parseRole(formData);
    const before = role.permissions.map((p) => p.permissionKey);
    const added = input.permissions.filter((p) => !before.includes(p));
    const removed = before.filter((p) => !input.permissions.includes(p as PermissionKey));
    assertCanHandOut(user, added);

    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.role.update({ where: { id: roleId }, data: { name: input.name, description: input.description } });
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({ data: input.permissions.map((permissionKey) => ({ roleId, permissionKey })) });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "role.updated",
        target: { type: "Role", id: roleId, label: input.name },
        metadata: { added, removed, renamed: role.name !== input.name ? { from: role.name, to: input.name } : undefined },
        meta,
      });
    });
    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleId}`);
    return null;
  });
}

export async function deleteRoleAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("roles.manage");
    const roleId = String(formData.get("roleId") ?? "");
    const role = await db.role.findUnique({
      where: { id: roleId },
      include: { _count: { select: { users: true, invites: { where: { acceptedAt: null, revokedAt: null } } } } },
    });
    if (!role) throw new UserError("That role no longer exists.");
    const problem = roleDeleteProblem({ isSystem: role.isSystem, memberCount: role._count.users, pendingInvites: role._count.invites });
    if (problem) throw new UserError(problem);
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.invite.deleteMany({ where: { roleId } });
      await tx.role.delete({ where: { id: roleId } });
      await writeAuditLog(tx, { actor: { id: user.id, name: user.name }, action: "role.deleted", target: { type: "Role", id: roleId, label: role.name }, meta });
    });
    return null;
  });
  if (result.ok) redirect("/admin/roles");
  return result;
}
