import type { Prisma } from "@/generated/prisma/client";
import type { RequestMeta } from "./request-meta";

export type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export type AuditEntry = {
  actor: { id: string; name: string } | null;
  action: string;
  target: { type: string; id?: string | null; label?: string };
  metadata?: Record<string, unknown>;
  meta?: RequestMeta;
};

/** Call with the transaction client (`tx`) when inside a transaction so the log commits with the change. */
export async function writeAuditLog(client: AuditClient, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actor?.id ?? null,
      actorName: entry.actor?.name ?? "System",
      action: entry.action,
      targetType: entry.target.type,
      targetId: entry.target.id ?? null,
      targetLabel: entry.target.label ?? "",
      metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
      ip: entry.meta?.ip ?? null,
      userAgent: entry.meta?.userAgent ?? null,
    },
  });
}
