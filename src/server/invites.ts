import "server-only";
import { hashToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";

export const INVALID_INVITE = "This invite link has expired or was already used. Ask an admin for a new one.";

/** Looks up a usable invite by its raw token (null if missing, expired, revoked or used). */
export async function findUsableInvite(token: string) {
  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(token) }, include: { role: true } });
  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date()) return null;
  return invite;
}
