"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeAdminRedirect } from "@/lib/auth/redirect";
import { clearSessionCookie, createSession, destroySession, getSession, setSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import { loginIpLimiter, loginLimiter } from "@/lib/security/limiters";

export type LoginState = { error?: string; email?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});

let dummyHash: Promise<string> | undefined;
/** Verifying against a throwaway hash keeps timing equal whether or not the email exists. */
function getDummyHash() {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  return dummyHash;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const typedEmail = String(formData.get("email") ?? "").slice(0, 254);
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password.", email: typedEmail };
  const { email, password } = parsed.data;

  const meta = await getRequestMeta();
  const ip = meta.ip ?? "unknown";
  const perEmail = loginLimiter.check(`${ip}:${email}`);
  const perIp = loginIpLimiter.check(ip);
  if (!perEmail.allowed || !perIp.allowed) {
    const minutes = Math.ceil(Math.max(perEmail.retryAfterMs, perIp.retryAfterMs) / 60_000);
    return { error: `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, email };
  }

  const user = await db.adminUser.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !passwordOk || !user.isActive) {
    await writeAuditLog(db, {
      actor: null,
      action: "auth.login_failed",
      target: { type: "AdminUser", id: user?.id, label: email },
      meta,
    });
    return { error: "Email or password is incorrect.", email };
  }

  loginLimiter.reset(`${ip}:${email}`);
  const { token } = await createSession(user.id, meta);
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog(db, {
    actor: { id: user.id, name: user.name },
    action: "auth.login",
    target: { type: "AdminUser", id: user.id, label: user.email },
    meta,
  });
  await setSessionCookie(token);
  redirect(safeAdminRedirect(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  const user = await getSession();
  if (user) {
    await destroySession(user.sessionId);
    await writeAuditLog(db, {
      actor: { id: user.id, name: user.name },
      action: "auth.logout",
      target: { type: "AdminUser", id: user.id, label: user.email },
      meta: await getRequestMeta(),
    });
  }
  await clearSessionCookie();
  redirect("/admin/login");
}
