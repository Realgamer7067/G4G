"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request-meta";
import { inviteLimiter } from "@/lib/security/limiters";
import { INVALID_INVITE, findUsableInvite } from "@/server/invites";

const acceptSchema = z
  .object({
    token: z.string().min(10),
    name: z.string().trim().min(1, "Enter your name.").max(80, "Keep it under 80 characters."),
    password: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.password);
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });

export async function acceptInviteAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const meta = await getRequestMeta();
    if (!inviteLimiter.check(meta.ip ?? "unknown").allowed) {
      throw new UserError("Too many attempts from this network. Try again in 15 minutes.");
    }
    const input = acceptSchema.parse({
      token: formData.get("token"),
      name: formData.get("name"),
      password: formData.get("password"),
      confirm: formData.get("confirm"),
    });
    const invite = await findUsableInvite(input.token);
    if (!invite) throw new UserError(INVALID_INVITE);
    if (await db.adminUser.findUnique({ where: { email: invite.email } })) {
      throw new UserError("An account with this email already exists. Sign in instead.");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await db.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: { email: invite.email, name: input.name, passwordHash, roleId: invite.roleId, lastLoginAt: new Date() },
      });
      // Conditional update: a second concurrent acceptance of the same link finds nothing to update.
      const { count } = await tx.invite.updateMany({
        where: { id: invite.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (count !== 1) throw new UserError(INVALID_INVITE);
      await writeAuditLog(tx, {
        actor: { id: created.id, name: created.name },
        action: "admin.invite_accepted",
        target: { type: "AdminUser", id: created.id, label: created.email },
        metadata: { role: invite.role.name },
        meta,
      });
      return created;
    });

    const { token } = await createSession(user.id, meta);
    await setSessionCookie(token);
    return null;
  });
  if (result.ok) redirect("/admin");
  return result;
}
