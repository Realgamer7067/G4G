import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import type { RequestMeta } from "@/lib/request-meta";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { resolveEffectivePermissions } from "@/lib/rbac/resolve";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, evaluateSession } from "./session-policy";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-gfg_session" : "gfg_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  sessionId: string;
  permissions: ReadonlySet<PermissionKey>;
};

export async function createSession(userId: string, meta: RequestMeta, now: Date = new Date()) {
  const token = generateToken();
  const sessionId = hashToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
  await db.session.create({
    data: { id: sessionId, userId, expiresAt, createdAt: now, lastSeenAt: now, ip: meta.ip, userAgent: meta.userAgent },
  });
  return { token, sessionId, expiresAt };
}

export async function loadSessionByToken(token: string, now: Date = new Date()): Promise<SessionUser | null> {
  const sessionId = hashToken(token);
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: { include: { role: { include: { permissions: true } }, permissionOverrides: true } } },
  });
  if (!session) return null;

  const verdict = evaluateSession(session, session.user.isActive, now);
  if (!verdict.valid) {
    await db.session.deleteMany({ where: { id: sessionId } });
    return null;
  }
  if (verdict.touch) {
    await db.session.update({ where: { id: sessionId }, data: { lastSeenAt: now, expiresAt: verdict.newExpiresAt } });
  }

  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleKey: user.role.key,
    roleName: user.role.name,
    sessionId,
    permissions: resolveEffectivePermissions({
      roleKey: user.role.key,
      rolePermissionKeys: user.role.permissions.map((p) => p.permissionKey),
      overrides: user.permissionOverrides,
    }),
  };
}

/** Request-scoped: every call within one render/action shares the result. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? loadSessionByToken(token) : null;
});

const COOKIE_ATTRIBUTES = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { ...COOKIE_ATTRIBUTES, maxAge: SESSION_ABSOLUTE_MS / 1000 });
}

/** Expire with the same attributes: browsers ignore a `__Host-` cookie update that lacks `Secure` and `Path=/`. */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...COOKIE_ATTRIBUTES, maxAge: 0 });
}

export async function destroySession(sessionId: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sessionId } });
}

export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return count;
}
