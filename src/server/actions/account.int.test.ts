import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, loadSessionByToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createAdmin } from "@/test/factories";

let cookieToken: string | undefined;
const setCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "gfg_session" && cookieToken ? { name, value: cookieToken } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => setCookies.push({ name, value, options }),
    delete: () => {
      throw new Error("use set(..., { maxAge: 0 }) so __Host- cookies are actually cleared");
    },
  }),
  headers: async () => new Headers({ "x-real-ip": "127.0.0.1", "user-agent": "vitest" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { updateProfileAction, changePasswordAction, revokeSessionAction, signOutOtherSessionsAction } = await import("./account");
const { logoutAction } = await import("./auth");

const OLD = "old pine password 1";
const NEW = "new pine password 22";
const meta = { ip: "127.0.0.1", userAgent: "vitest" };

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

/** Signs an admin in (sets the mocked cookie) and returns the admin plus their current session. */
async function signedInAdmin(opts: Parameters<typeof createAdmin>[0] = {}) {
  const admin = await createAdmin({ password: OLD, ...opts });
  const session = await createSession(admin.id, meta);
  cookieToken = session.token;
  return { admin, session };
}

beforeEach(() => {
  cookieToken = undefined;
  setCookies.length = 0;
});

describe("updateProfileAction", () => {
  it("saves the trimmed name and audits the change", async () => {
    const { admin } = await signedInAdmin();
    expect(await updateProfileAction(undefined, form({ name: "  Priya Shah  " }))).toEqual({ ok: true, data: null });
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).name).toBe("Priya Shah");
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "account.profile_updated" } });
    expect(log.metadata).toEqual({ from: admin.name, to: "Priya Shah" });
  });

  it("rejects an empty name", async () => {
    await signedInAdmin();
    const result = await updateProfileAction(undefined, form({ name: "   " }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.name).toEqual(["Enter your name."]);
  });

  it("refuses without a session", async () => {
    expect(await updateProfileAction(undefined, form({ name: "X" }))).toEqual({
      ok: false,
      error: "Your session has ended. Sign in again.",
    });
  });
});

describe("changePasswordAction", () => {
  it("rejects a wrong current password and leaves the hash alone", async () => {
    const { admin } = await signedInAdmin();
    const before = (await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).passwordHash;
    const result = await changePasswordAction(undefined, form({ current: "not it at all", next: NEW, confirm: NEW }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.current).toEqual(["Current password is incorrect."]);
    expect((await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } })).passwordHash).toBe(before);
  });

  it("flags a short new password and a mismatched confirmation", async () => {
    await signedInAdmin();
    const short = await changePasswordAction(undefined, form({ current: OLD, next: "short", confirm: "short" }));
    if (!short.ok) expect(short.fieldErrors?.next).toEqual(["Use at least 12 characters."]);
    else throw new Error("expected failure");
    const mismatch = await changePasswordAction(undefined, form({ current: OLD, next: NEW, confirm: `${NEW}!` }));
    if (!mismatch.ok) expect(mismatch.fieldErrors?.confirm).toEqual(["Passwords don't match."]);
    else throw new Error("expected failure");
  });

  it("changes the password, signs out other sessions and keeps this one", async () => {
    const { admin, session } = await signedInAdmin();
    const other = await createSession(admin.id, meta);
    expect(await changePasswordAction(undefined, form({ current: OLD, next: NEW, confirm: NEW }))).toEqual({ ok: true, data: null });

    const record = await db.adminUser.findUniqueOrThrow({ where: { id: admin.id } });
    expect(await verifyPassword(record.passwordHash, NEW)).toBe(true);
    expect(await verifyPassword(record.passwordHash, OLD)).toBe(false);
    expect(await loadSessionByToken(other.token)).toBeNull();
    expect(await loadSessionByToken(session.token)).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "account.password_changed", actorId: admin.id } })).toBe(1);
  });
});

describe("session management", () => {
  it("only revokes sessions that belong to the signed-in admin", async () => {
    const { admin } = await signedInAdmin();
    const mine = await createSession(admin.id, meta);
    const stranger = await createAdmin();
    const theirs = await createSession(stranger.id, meta);

    await revokeSessionAction(form({ sessionId: theirs.sessionId }));
    expect(await db.session.findUnique({ where: { id: theirs.sessionId } })).not.toBeNull();

    await revokeSessionAction(form({ sessionId: mine.sessionId }));
    expect(await db.session.findUnique({ where: { id: mine.sessionId } })).toBeNull();
  });

  it("will not revoke the current session through the revoke button", async () => {
    const { session } = await signedInAdmin();
    await revokeSessionAction(form({ sessionId: session.sessionId }));
    expect(await db.session.findUnique({ where: { id: session.sessionId } })).not.toBeNull();
  });

  it("signs out every other session and records how many", async () => {
    const { admin, session } = await signedInAdmin();
    await createSession(admin.id, meta);
    await createSession(admin.id, meta);
    await signOutOtherSessionsAction();
    expect(await db.session.count({ where: { userId: admin.id } })).toBe(1);
    expect(await loadSessionByToken(session.token)).not.toBeNull();
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "account.sessions_revoked" } });
    expect(log.metadata).toEqual({ count: 2 });
  });
});

describe("logoutAction", () => {
  it("deletes the session, expires the cookie with matching attributes and redirects", async () => {
    const { admin, session } = await signedInAdmin();
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/admin/login");
    expect(await db.session.findUnique({ where: { id: session.sessionId } })).toBeNull();
    expect(setCookies).toEqual([
      { name: "gfg_session", value: "", options: { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: 0 } },
    ]);
    expect(await db.auditLog.count({ where: { action: "auth.logout", actorId: admin.id } })).toBe(1);
  });
});
