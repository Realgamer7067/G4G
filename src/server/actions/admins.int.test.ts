import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, loadSessionByToken } from "@/lib/auth/session";
import { hashToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { syncPermissions } from "@/lib/rbac/sync";
import { createAdmin } from "@/test/factories";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { createInviteAction, updateAdminRoleAction, setAdminActiveAction, saveOverridesAction } = await import("./admins");

async function role(key: string, permissions: string[] = []) {
  await syncPermissions(db);
  return db.role.upsert({
    where: { key },
    create: { key, name: key, permissions: { create: permissions.map((permissionKey) => ({ permissionKey })) } },
    update: {},
  });
}

beforeEach(() => resetMockRequest());

describe("createInviteAction", () => {
  it("requires admins.manage", async () => {
    await signIn({ permissions: ["dashboard.view"] });
    const r = await role("team_manager", ["team.manage"]);
    expect(await createInviteAction(undefined, formOf({ email: "new@example.test", roleId: r.id }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
  });

  it("creates a single-use link, revoking older pending invites for the same email", async () => {
    const { admin } = await signIn({ roleKey: "super_admin" });
    const r = await role("team_manager", ["team.manage"]);
    const first = await createInviteAction(undefined, formOf({ email: "New@Example.test", roleId: r.id }));
    const second = await createInviteAction(undefined, formOf({ email: "new@example.test", roleId: r.id }));
    if (!first.ok || !second.ok) throw new Error("expected success");

    expect(second.data.url).toMatch(/\/admin\/invite\/[A-Za-z0-9_-]{43}$/);
    const token = second.data.url.split("/").pop()!;
    const invites = await db.invite.findMany({ orderBy: { createdAt: "asc" } });
    expect(invites).toHaveLength(2);
    expect(invites[0].revokedAt).not.toBeNull();
    expect(invites[1]).toMatchObject({ email: "new@example.test", tokenHash: hashToken(token), revokedAt: null, invitedById: admin.id });
    expect(await db.auditLog.count({ where: { action: "admin.invited" } })).toBe(2);
  });

  it("stops non-super admins from inviting super admins or roles stronger than their own", async () => {
    await signIn({ permissions: ["admins.manage", "team.manage"] });
    const superRole = await role("super_admin");
    const settingsRole = await role("settings_role", ["settings.manage"]);
    expect(await createInviteAction(undefined, formOf({ email: "a@example.test", roleId: superRole.id }))).toEqual({
      ok: false,
      error: "Only a super admin can grant Super Admin.",
    });
    expect(await createInviteAction(undefined, formOf({ email: "b@example.test", roleId: settingsRole.id }))).toEqual({
      ok: false,
      error: "You can only grant permissions you have yourself. Not allowed: settings.manage.",
    });
  });

  it("rejects an email that already has an account", async () => {
    await signIn({ roleKey: "super_admin" });
    const existing = await createAdmin();
    const r = await role("team_manager", ["team.manage"]);
    const result = await createInviteAction(undefined, formOf({ email: existing.email, roleId: r.id }));
    expect(result).toMatchObject({ ok: false, fieldErrors: { email: ["An admin with this email already exists."] } });
  });
});

describe("admin changes", () => {
  it("keeps at least one active super admin", async () => {
    const { admin: me } = await signIn({ roleKey: "super_admin" });
    const otherSuper = await db.adminUser.create({
      data: { email: "s2@example.test", name: "S2", passwordHash: "x", roleId: me.roleId, isActive: true },
    });
    const r = await role("team_manager", ["team.manage"]);

    // Two active super admins: demoting the other one is allowed.
    expect(await updateAdminRoleAction(undefined, formOf({ userId: otherSuper.id, roleId: r.id }))).toEqual({ ok: true, data: null });
    // Now only the actor remains; they can't demote themselves either.
    expect(await updateAdminRoleAction(undefined, formOf({ userId: me.id, roleId: r.id }))).toEqual({
      ok: false,
      error: "You can't change your own access. Ask another admin.",
    });
  });

  it("deactivating an admin signs them out everywhere", async () => {
    await signIn({ roleKey: "super_admin" });
    const target = await createAdmin({ permissions: ["team.manage"] });
    const session = await createSession(target.id, { ip: null, userAgent: null });
    expect(await setAdminActiveAction(undefined, formOf({ userId: target.id, active: "false" }))).toEqual({ ok: true, data: null });
    expect(await loadSessionByToken(session.token)).toBeNull();
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: target.id } })).isActive).toBe(false);
    expect(await db.auditLog.count({ where: { action: "admin.deactivated" } })).toBe(1);
  });

  it("saves per-person grants and denies, within the actor's own permissions", async () => {
    await signIn({ permissions: ["admins.manage", "events.create", "logs.view"] });
    const target = await createAdmin({ permissions: ["events.create", "events.delete"] });

    const ok = await saveOverridesAction(
      undefined,
      formOf({ userId: target.id, "perm.logs.view": "grant", "perm.events.delete": "deny", "perm.team.manage": "inherit" }),
    );
    expect(ok).toEqual({ ok: true, data: null });
    const rows = await db.userPermissionOverride.findMany({ where: { userId: target.id }, orderBy: { permissionKey: "asc" } });
    expect(rows.map((r) => [r.permissionKey, r.effect])).toEqual([
      ["events.delete", "DENY"],
      ["logs.view", "GRANT"],
    ]);

    const escalate = await saveOverridesAction(undefined, formOf({ userId: target.id, "perm.settings.manage": "grant" }));
    expect(escalate).toEqual({ ok: false, error: "You can only grant permissions you have yourself. Not allowed: settings.manage." });
  });
});
