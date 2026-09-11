"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { adminChangeProblem, beyondActorMessage, canAssignRole, permissionsBeyondActor, type AdminChange } from "@/lib/admin/policies";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { ForbiddenError, UserError } from "@/lib/errors";
import { ALL_PERMISSION_KEYS, isPermissionKey } from "@/lib/rbac/permissions";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/roles";
import { getRequestMeta } from "@/lib/request-meta";

const INVITE_TTL_MS = 72 * 3_600_000;

export type InviteResult = { url: string; email: string; expiresAt: string };

const actorOf = (user: SessionUser) => ({ id: user.id, name: user.name });

async function assertRoleWithinActor(user: SessionUser, roleId: string) {
  const role = await db.role.findUnique({ where: { id: roleId }, include: { permissions: true } });
  if (!role) throw new UserError("Pick a role.", { roleId: ["Pick a role."] });
  if (!canAssignRole(user, role.key)) throw new ForbiddenError("Only a super admin can grant Super Admin.");
  const missing = permissionsBeyondActor(
    user,
    role.key === SUPER_ADMIN_ROLE_KEY ? ALL_PERMISSION_KEYS : role.permissions.map((p) => p.permissionKey),
  );
  if (missing.length) throw new ForbiddenError(beyondActorMessage(missing));
  return role;
}

async function loadTarget(userId: string) {
  const target = await db.adminUser.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target) throw new UserError("That admin no longer exists.");
  const activeSuperAdmins = await db.adminUser.count({ where: { isActive: true, role: { key: SUPER_ADMIN_ROLE_KEY } } });
  return { target, activeSuperAdmins };
}

async function assertChangeAllowed(user: SessionUser, userId: string, change: AdminChange) {
  const { target, activeSuperAdmins } = await loadTarget(userId);
  const problem = adminChangeProblem({
    actor: { id: user.id, roleKey: user.roleKey },
    target: { id: target.id, roleKey: target.role.key, isActive: target.isActive },
    activeSuperAdmins,
    change,
  });
  if (problem) throw new UserError(problem);
  return target;
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  roleId: z.string().min(1, "Pick a role."),
});

export async function createInviteAction(_prev: ActionResult<InviteResult> | undefined, formData: FormData): Promise<ActionResult<InviteResult>> {
  return runAction(async () => {
    const user = await requirePermission("admins.manage");
    const input = inviteSchema.parse({ email: formData.get("email"), roleId: formData.get("roleId") });
    const role = await assertRoleWithinActor(user, input.roleId);
    if (await db.adminUser.findUnique({ where: { email: input.email } })) {
      throw new UserError("An admin with this email already exists.", { email: ["An admin with this email already exists."] });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.invite.updateMany({
        where: { email: input.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const invite = await tx.invite.create({
        data: { email: input.email, tokenHash: hashToken(token), roleId: role.id, invitedById: user.id, expiresAt },
      });
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: "admin.invited",
        target: { type: "Invite", id: invite.id, label: input.email },
        metadata: { role: role.name },
        meta,
      });
    });

    revalidatePath("/admin/users");
    const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return { url: `${base}/admin/invite/${token}`, email: input.email, expiresAt: expiresAt.toISOString() };
  });
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  const user = await requirePermission("admins.manage");
  const id = String(formData.get("inviteId") ?? "");
  const invite = await db.invite.findUnique({ where: { id } });
  if (!invite || invite.acceptedAt || invite.revokedAt) return;
  const meta = await getRequestMeta();
  await db.$transaction(async (tx) => {
    await tx.invite.update({ where: { id }, data: { revokedAt: new Date() } });
    await writeAuditLog(tx, { actor: actorOf(user), action: "admin.invite_revoked", target: { type: "Invite", id, label: invite.email }, meta });
  });
  revalidatePath("/admin/users");
}

export async function updateAdminRoleAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("admins.manage");
    const userId = String(formData.get("userId") ?? "");
    const role = await assertRoleWithinActor(user, String(formData.get("roleId") ?? ""));
    const target = await assertChangeAllowed(user, userId, { kind: "role", newRoleKey: role.key });
    if (target.roleId === role.id) return null;
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: userId }, data: { roleId: role.id } });
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: "admin.role_changed",
        target: { type: "AdminUser", id: userId, label: target.email },
        metadata: { from: target.role.name, to: role.name },
        meta,
      });
    });
    revalidatePath("/admin/users");
    return null;
  });
}

export async function setAdminActiveAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("admins.manage");
    const userId = String(formData.get("userId") ?? "");
    const active = formData.get("active") === "true";
    const target = await assertChangeAllowed(user, userId, { kind: active ? "activate" : "deactivate" });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: userId }, data: { isActive: active } });
      if (!active) await tx.session.deleteMany({ where: { userId } });
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: active ? "admin.activated" : "admin.deactivated",
        target: { type: "AdminUser", id: userId, label: target.email },
        meta,
      });
    });
    revalidatePath("/admin/users");
    return null;
  });
}

export async function saveOverridesAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("admins.manage");
    const userId = String(formData.get("userId") ?? "");
    const target = await assertChangeAllowed(user, userId, { kind: "overrides" });

    const grants: string[] = [];
    const denies: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith("perm.")) continue;
      const permission = key.slice(5);
      if (!isPermissionKey(permission)) continue;
      if (value === "grant") grants.push(permission);
      else if (value === "deny") denies.push(permission);
    }
    const missing = permissionsBeyondActor(user, grants);
    if (missing.length) throw new ForbiddenError(beyondActorMessage(missing));

    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.userPermissionOverride.deleteMany({ where: { userId } });
      await tx.userPermissionOverride.createMany({
        data: [
          ...grants.map((permissionKey) => ({ userId, permissionKey, effect: "GRANT" as const })),
          ...denies.map((permissionKey) => ({ userId, permissionKey, effect: "DENY" as const })),
        ],
      });
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: "admin.permissions_changed",
        target: { type: "AdminUser", id: userId, label: target.email },
        metadata: { grants, denies },
        meta,
      });
    });
    revalidatePath(`/admin/users/${userId}`);
    return null;
  });
}
