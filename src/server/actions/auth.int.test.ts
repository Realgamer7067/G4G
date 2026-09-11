import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createAdmin } from "@/test/factories";

// Each test uses its own client IP so the module-level rate limiters never leak between tests.
let ip = "10.0.0.1";
const setCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, value: string, options?: Record<string, unknown>) => setCookies.push({ name, value, options }),
    delete: () => {},
  }),
  headers: async () => new Headers({ "x-real-ip": ip, "user-agent": "vitest" }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { loginAction } = await import("./auth");

const PASSWORD = "pine night green 42";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

let ipCounter = 0;
beforeEach(() => {
  ipCounter += 1;
  ip = `10.0.0.${ipCounter}`;
  setCookies.length = 0;
});

describe("loginAction", () => {
  it("signs in with the right password, sets the session cookie and audits it", async () => {
    const admin = await createAdmin({ email: "lead@example.test", password: PASSWORD });
    await expect(loginAction(undefined, form({ email: "Lead@Example.test ", password: PASSWORD }))).rejects.toThrow(
      "REDIRECT:/admin",
    );
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]).toMatchObject({ name: "gfg_session", options: { httpOnly: true, sameSite: "lax", path: "/" } });
    expect(await db.session.count({ where: { userId: admin.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "auth.login", actorId: admin.id } })).toBe(1);
  });

  it("only redirects back inside the admin area", async () => {
    await createAdmin({ email: "a@example.test", password: PASSWORD });
    await expect(
      loginAction(undefined, form({ email: "a@example.test", password: PASSWORD, next: "/admin/account" })),
    ).rejects.toThrow("REDIRECT:/admin/account");
    await expect(
      loginAction(undefined, form({ email: "a@example.test", password: PASSWORD, next: "https://evil.test" })),
    ).rejects.toThrow("REDIRECT:/admin");
  });

  it("rejects a wrong password with a generic message and audits the failure", async () => {
    await createAdmin({ email: "b@example.test", password: PASSWORD });
    const result = await loginAction(undefined, form({ email: "b@example.test", password: "not the password" }));
    expect(result).toEqual({ error: "Email or password is incorrect.", email: "b@example.test" });
    expect(setCookies).toHaveLength(0);
    expect(await db.auditLog.count({ where: { action: "auth.login_failed" } })).toBe(1);
  });

  it("gives the same message for unknown emails and deactivated admins", async () => {
    await createAdmin({ email: "gone@example.test", password: PASSWORD, isActive: false });
    expect(await loginAction(undefined, form({ email: "nobody@example.test", password: PASSWORD }))).toMatchObject({
      error: "Email or password is incorrect.",
    });
    expect(await loginAction(undefined, form({ email: "gone@example.test", password: PASSWORD }))).toMatchObject({
      error: "Email or password is incorrect.",
    });
    expect(setCookies).toHaveLength(0);
  });

  it("asks for both fields when the form is incomplete", async () => {
    expect(await loginAction(undefined, form({ email: "", password: "" }))).toMatchObject({
      error: "Enter your email and password.",
    });
  });

  it("locks out after five attempts, even with the right password", async () => {
    await createAdmin({ email: "c@example.test", password: PASSWORD });
    for (let i = 0; i < 5; i++) {
      expect(await loginAction(undefined, form({ email: "c@example.test", password: "wrong wrong wrong" }))).toMatchObject({
        error: "Email or password is incorrect.",
      });
    }
    const blocked = await loginAction(undefined, form({ email: "c@example.test", password: PASSWORD }));
    expect(blocked?.error).toMatch(/^Too many sign-in attempts\. Try again in 15 minutes\.$/);
    expect(setCookies).toHaveLength(0);
  });
});
