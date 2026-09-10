import { describe, expect, it } from "vitest";
import { ALL_PERMISSION_KEYS, PERMISSIONS, isPermissionKey } from "./permissions";
import { ROLE_PRESETS, SUPER_ADMIN_ROLE_KEY } from "./roles";
import { resolveEffectivePermissions } from "./resolve";

describe("permission catalogue", () => {
  it("has unique, dotted, lowercase keys", () => {
    const keys = PERMISSIONS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z]+(\.[a-z]+)+$/);
  });
  it("includes every key named in the brief", () => {
    for (const k of [
      "events.create", "events.edit", "events.delete", "events.publish",
      "forms.create", "forms.responses.view", "forms.responses.export",
      "team.manage", "homepage.edit", "gallery.manage", "announcements.manage",
      "sponsors.manage", "admins.manage", "settings.manage", "logs.view",
    ]) expect(isPermissionKey(k)).toBe(true);
  });
  it("rejects unknown keys", () => {
    expect(isPermissionKey("events.hack")).toBe(false);
  });
});

describe("role presets", () => {
  it("defines exactly one system role: super admin with every permission", () => {
    const system = ROLE_PRESETS.filter((r) => r.isSystem);
    expect(system).toHaveLength(1);
    expect(system[0].key).toBe(SUPER_ADMIN_ROLE_KEY);
    expect(system[0].permissions).toBe("*");
  });
  it("only references known permissions and always grants dashboard access", () => {
    for (const preset of ROLE_PRESETS) {
      if (preset.permissions === "*") continue;
      for (const k of preset.permissions) expect(isPermissionKey(k)).toBe(true);
      expect(preset.permissions).toContain("dashboard.view");
    }
  });
});

describe("resolveEffectivePermissions", () => {
  it("gives super admin every permission and ignores deny overrides", () => {
    const perms = resolveEffectivePermissions({
      roleKey: SUPER_ADMIN_ROLE_KEY,
      rolePermissionKeys: [],
      overrides: [{ permissionKey: "logs.view", effect: "DENY" }],
    });
    expect(perms.size).toBe(ALL_PERMISSION_KEYS.length);
    expect(perms.has("logs.view")).toBe(true);
  });
  it("returns role permissions for a normal role", () => {
    const perms = resolveEffectivePermissions({
      roleKey: "team_manager",
      rolePermissionKeys: ["dashboard.view", "team.manage"],
      overrides: [],
    });
    expect([...perms].sort()).toEqual(["dashboard.view", "team.manage"]);
  });
  it("adds grants and removes denies, deny winning over grant", () => {
    const perms = resolveEffectivePermissions({
      roleKey: "event_manager",
      rolePermissionKeys: ["dashboard.view", "events.create", "events.delete"],
      overrides: [
        { permissionKey: "logs.view", effect: "GRANT" },
        { permissionKey: "events.delete", effect: "DENY" },
        { permissionKey: "team.manage", effect: "GRANT" },
        { permissionKey: "team.manage", effect: "DENY" },
      ],
    });
    expect(perms.has("logs.view")).toBe(true);
    expect(perms.has("events.delete")).toBe(false);
    expect(perms.has("team.manage")).toBe(false);
    expect(perms.has("events.create")).toBe(true);
  });
  it("drops unknown keys coming from the database", () => {
    const perms = resolveEffectivePermissions({
      roleKey: "custom",
      rolePermissionKeys: ["dashboard.view", "legacy.thing"],
      overrides: [{ permissionKey: "other.legacy", effect: "GRANT" }],
    });
    expect([...perms]).toEqual(["dashboard.view"]);
  });
});
