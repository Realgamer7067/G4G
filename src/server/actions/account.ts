"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requireActionUser } from "@/lib/auth/guard";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { destroyUserSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request-meta";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Keep it under 80 characters."),
});

export async function updateProfileAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { name } = profileSchema.parse({ name: formData.get("name") });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: user.id }, data: { name } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name },
        action: "account.profile_updated",
        target: { type: "AdminUser", id: user.id, label: user.email },
        metadata: { from: user.name, to: name },
        meta,
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.next);
    if (problem) ctx.addIssue({ code: "custom", path: ["next"], message: problem });
    if (v.next !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });

export async function changePasswordAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const input = passwordSchema.parse({
      current: formData.get("current"),
      next: formData.get("next"),
      confirm: formData.get("confirm"),
    });
    const record = await db.adminUser.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(record.passwordHash, input.current))) {
      throw new UserError("Current password is incorrect.", { current: ["Current password is incorrect."] });
    }
    const passwordHash = await hashPassword(input.next);
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: user.id }, data: { passwordHash } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "account.password_changed",
        target: { type: "AdminUser", id: user.id, label: user.email },
        meta,
      });
    });
    await destroyUserSessions(user.id, user.sessionId);
    revalidatePath("/admin/account");
    return null;
  });
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await requireActionUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId || sessionId === user.sessionId) return;
  const { count } = await db.session.deleteMany({ where: { id: sessionId, userId: user.id } });
  if (count) {
    await writeAuditLog(db, {
      actor: { id: user.id, name: user.name },
      action: "account.session_revoked",
      target: { type: "AdminUser", id: user.id, label: user.email },
      meta: await getRequestMeta(),
    });
  }
  revalidatePath("/admin/account");
}

export async function signOutOtherSessionsAction(): Promise<void> {
  const user = await requireActionUser();
  const count = await destroyUserSessions(user.id, user.sessionId);
  await writeAuditLog(db, {
    actor: { id: user.id, name: user.name },
    action: "account.sessions_revoked",
    target: { type: "AdminUser", id: user.id, label: user.email },
    metadata: { count },
    meta: await getRequestMeta(),
  });
  revalidatePath("/admin/account");
}
