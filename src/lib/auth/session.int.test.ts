import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { createAdmin } from "@/test/factories";
import { SESSION_IDLE_MS } from "./session-policy";

let cookieToken: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "gfg_session" && cookieToken ? { name, value: cookieToken } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));

const { createSession, loadSessionByToken, destroyUserSessions } = await import("./session");
const { requirePermission } = await import("./guard");
const meta = { ip: "127.0.0.1", userAgent: "vitest" };

beforeEach(() => {
  cookieToken = undefined;
});

describe("sessions", () => {
  it("loads the user with role permissions", async () => {
    const admin = await createAdmin({ permissions: ["dashboard.view", "events.create"] });
    const { token } = await createSession(admin.id, meta);
    const user = await loadSessionByToken(token);
    expect(user?.email).toBe(admin.email);
    expect([...(user?.permissions ?? [])].sort()).toEqual(["dashboard.view", "events.create"]);
  });

  it("applies grant and deny overrides", async () => {
    const admin = await createAdmin({
      permissions: ["dashboard.view", "events.delete"],
      overrides: [
        { permissionKey: "events.delete", effect: "DENY" },
        { permissionKey: "logs.view", effect: "GRANT" },
      ],
    });
    const { token } = await createSession(admin.id, meta);
    const user = await loadSessionByToken(token);
    expect(user?.permissions.has("events.delete")).toBe(false);
    expect(user?.permissions.has("logs.view")).toBe(true);
  });

  it("gives the super admin role every permission", async () => {
    const admin = await createAdmin({ roleKey: "super_admin" });
    const { token } = await createSession(admin.id, meta);
    expect((await loadSessionByToken(token))?.permissions.has("admins.manage")).toBe(true);
  });

  it("rejects and deletes expired sessions", async () => {
    const admin = await createAdmin();
    const start = new Date("2026-01-01T00:00:00Z");
    const { token, sessionId } = await createSession(admin.id, meta, start);
    expect(await loadSessionByToken(token, new Date(start.getTime() + SESSION_IDLE_MS + 1))).toBeNull();
    expect(await db.session.findUnique({ where: { id: sessionId } })).toBeNull();
  });

  it("rejects sessions of deactivated admins", async () => {
    const admin = await createAdmin({ isActive: false });
    const { token } = await createSession(admin.id, meta);
    expect(await loadSessionByToken(token)).toBeNull();
  });

  it("touches lastSeenAt after a day", async () => {
    const admin = await createAdmin();
    const start = new Date("2026-01-01T00:00:00Z");
    const { token, sessionId } = await createSession(admin.id, meta, start);
    const later = new Date(start.getTime() + 26 * 3_600_000);
    await loadSessionByToken(token, later);
    const row = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row.lastSeenAt.toISOString()).toBe(later.toISOString());
  });

  it("destroys other sessions but keeps the current one", async () => {
    const admin = await createAdmin();
    const a = await createSession(admin.id, meta);
    await createSession(admin.id, meta);
    await createSession(admin.id, meta);
    expect(await destroyUserSessions(admin.id, a.sessionId)).toBe(2);
    expect(await loadSessionByToken(a.token)).not.toBeNull();
  });

  it("returns null for unknown tokens", async () => {
    expect(await loadSessionByToken("nope")).toBeNull();
  });
});

describe("requirePermission", () => {
  it("throws UnauthorizedError without a session cookie", async () => {
    await expect(requirePermission("events.create")).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("throws ForbiddenError when the permission is missing", async () => {
    const admin = await createAdmin({ permissions: ["dashboard.view"] });
    cookieToken = (await createSession(admin.id, meta)).token;
    await expect(requirePermission("events.create")).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("returns the user when permitted", async () => {
    const admin = await createAdmin({ permissions: ["events.create"] });
    cookieToken = (await createSession(admin.id, meta)).token;
    expect((await requirePermission("events.create")).id).toBe(admin.id);
  });
});
