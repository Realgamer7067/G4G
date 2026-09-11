import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { syncPermissions } from "@/lib/rbac/sync";
import { createAdmin } from "@/test/factories";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { createRoleAction, updateRoleAction, deleteRoleAction } = await import("./roles");

beforeEach(() => resetMockRequest());

describe("createRoleAction", () => {
  it("requires roles.manage", async () => {
    await signIn({ permissions: ["admins.manage"] });
    expect(await createRoleAction(undefined, formOf({ name: "Design Crew" }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
  });

  it("creates a role with a generated key and its permissions", async () => {
    await signIn({ roleKey: "super_admin" });
    await expect(
      createRoleAction(undefined, formOf({ name: "Design Crew", description: "Posters", permissions: ["gallery.manage", "media.upload"] })),
    ).rejects.toThrow(/REDIRECT:\/admin\/roles\/.+\?created=1/);
    const role = await db.role.findUniqueOrThrow({ where: { key: "design_crew" }, include: { permissions: true } });
    expect(role.permissions.map((p) => p.permissionKey).sort()).toEqual(["gallery.manage", "media.upload"]);
    expect(await db.auditLog.count({ where: { action: "role.created" } })).toBe(1);
  });

  it("won't let a role manager hand out permissions they lack", async () => {
    await signIn({ permissions: ["roles.manage", "gallery.manage"] });
    expect(await createRoleAction(undefined, formOf({ name: "Sneaky", permissions: ["gallery.manage", "admins.manage"] }))).toEqual({
      ok: false,
      error: "You can only grant permissions you have yourself. Not allowed: admins.manage.",
    });
  });
});

describe("updateRoleAction", () => {
  it("records added and removed permissions", async () => {
    await signIn({ roleKey: "super_admin" });
    await syncPermissions(db);
    const role = await db.role.create({
      data: { key: "writers", name: "Writers", permissions: { create: [{ permissionKey: "announcements.manage" }] } },
    });
    const result = await updateRoleAction(undefined, formOf({ roleId: role.id, name: "Writers", permissions: ["gallery.manage"] }));
    expect(result).toEqual({ ok: true, data: null });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "role.updated" } });
    expect(log.metadata).toMatchObject({ added: ["gallery.manage"], removed: ["announcements.manage"] });
  });

  it("protects the super admin role and the editor's own role", async () => {
    const { admin } = await signIn({ permissions: ["roles.manage", "gallery.manage"] });
    const superRole = await db.role.create({ data: { key: "super_admin", name: "Super Admin", isSystem: true } });
    expect(await updateRoleAction(undefined, formOf({ roleId: superRole.id, name: "Super Admin" }))).toEqual({
      ok: false,
      error: "The Super Admin role always has every permission and can't be edited.",
    });
    expect(await updateRoleAction(undefined, formOf({ roleId: admin.roleId, name: "Mine", permissions: ["gallery.manage"] }))).toEqual({
      ok: false,
      error: "You can't change your own role. Ask a super admin.",
    });
  });
});

describe("deleteRoleAction", () => {
  it("refuses while members still hold the role", async () => {
    await signIn({ roleKey: "super_admin" });
    const member = await createAdmin({ permissions: ["team.manage"] });
    expect(await deleteRoleAction(undefined, formOf({ roleId: member.roleId }))).toEqual({
      ok: false,
      error: "Move its 1 member to another role first.",
    });
  });

  it("deletes an unused role", async () => {
    await signIn({ roleKey: "super_admin" });
    const role = await db.role.create({ data: { key: "old_role", name: "Old role" } });
    await expect(deleteRoleAction(undefined, formOf({ roleId: role.id }))).rejects.toThrow("REDIRECT:/admin/roles");
    expect(await db.role.findUnique({ where: { id: role.id } })).toBeNull();
  });
});
