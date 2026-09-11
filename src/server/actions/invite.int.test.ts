import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { createAdmin } from "@/test/factories";
import { mockRequest, resetMockRequest } from "@/test/mocks/state";
import { formOf } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { acceptInviteAction } = await import("./invite");
const { INVALID_INVITE } = await import("@/server/invites");

const PASSWORD = "a fresh pine password";
let ipCounter = 0;

async function makeInvite(overrides: { expiresAt?: Date; acceptedAt?: Date; revokedAt?: Date } = {}) {
  const inviter = await createAdmin();
  const role = await db.role.create({ data: { key: `r_${Date.now()}_${Math.random()}`.replace(".", ""), name: "Team Manager" } });
  const token = generateToken();
  await db.invite.create({
    data: {
      email: "joiner@example.test",
      tokenHash: hashToken(token),
      roleId: role.id,
      invitedById: inviter.id,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 3_600_000),
      acceptedAt: overrides.acceptedAt,
      revokedAt: overrides.revokedAt,
    },
  });
  return { token, role };
}

const accept = (token: string, extra: Record<string, string> = {}) =>
  acceptInviteAction(undefined, formOf({ token, name: "Priya Shah", password: PASSWORD, confirm: PASSWORD, ...extra }));

beforeEach(() => {
  resetMockRequest();
  ipCounter += 1;
  mockRequest.ip = `10.1.0.${ipCounter}`;
});

describe("acceptInviteAction", () => {
  it("creates the account with the invited role, signs in and redirects", async () => {
    const { token, role } = await makeInvite();
    await expect(accept(token)).rejects.toThrow("REDIRECT:/admin");
    const user = await db.adminUser.findUniqueOrThrow({ where: { email: "joiner@example.test" } });
    expect(user).toMatchObject({ name: "Priya Shah", roleId: role.id, isActive: true });
    expect(await verifyPassword(user.passwordHash, PASSWORD)).toBe(true);
    expect((await db.invite.findFirstOrThrow()).acceptedAt).not.toBeNull();
    expect(mockRequest.cookiesSet[0]?.name).toBe("gfg_session");
    expect(await db.auditLog.count({ where: { action: "admin.invite_accepted", actorId: user.id } })).toBe(1);
  });

  it("refuses expired, revoked and already-used links", async () => {
    for (const overrides of [{ expiresAt: new Date(Date.now() - 1000) }, { revokedAt: new Date() }, { acceptedAt: new Date() }]) {
      await db.invite.deleteMany();
      const { token } = await makeInvite(overrides);
      expect(await accept(token)).toEqual({ ok: false, error: INVALID_INVITE });
    }
    expect(await db.adminUser.count({ where: { email: "joiner@example.test" } })).toBe(0);
  });

  it("refuses an unknown token", async () => {
    expect(await accept(generateToken())).toEqual({ ok: false, error: INVALID_INVITE });
  });

  it("checks the password", async () => {
    const { token } = await makeInvite();
    const result = await accept(token, { confirm: "something else entirely" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { confirm: ["Passwords don't match."] } });
    const short = await accept(token, { password: "short", confirm: "short" });
    expect(short).toMatchObject({ ok: false, fieldErrors: { password: ["Use at least 12 characters."] } });
  });
});
