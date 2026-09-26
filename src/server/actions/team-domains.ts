// src/server/actions/team-domains.ts
"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request-meta";
import { reorderIds, teamDomainSchema } from "@/lib/team/schema";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

export async function saveDomainAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const input = teamDomainSchema.parse(Object.fromEntries(formData));
    const existing = input.id ? await db.domain.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That domain no longer exists.");
    const slug = await uniqueSlug(slugify(input.name), async (s) => {
      const hit = await db.domain.findUnique({ where: { slug: s }, select: { id: true } });
      return Boolean(hit && hit.id !== existing?.id);
    });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      const order = existing ? existing.order : await tx.domain.count();
      const saved = existing
        ? await tx.domain.update({ where: { id: existing.id }, data: { name: input.name, slug } })
        : await tx.domain.create({ data: { name: input.name, slug, order } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "team.domain_updated" : "team.domain_created",
        target: { type: "Domain", id: saved.id, label: saved.name },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}

export async function deleteDomainAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const domain = await db.domain.findUnique({
      where: { id: String(formData.get("id") ?? "") },
      include: { _count: { select: { members: true } } },
    });
    if (!domain) throw new UserError("That domain no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.domain.delete({ where: { id: domain.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.domain_deleted",
        target: { type: "Domain", id: domain.id, label: domain.name },
        metadata: { unassignedMembers: domain._count.members },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}

export async function moveDomainAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const direction = formData.get("direction") === "-1" ? -1 : 1;
    const domains = await db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    const reordered = reorderIds(
      domains.map((d) => d.id),
      id,
      direction,
    );
    if (!reordered) throw new UserError("That domain can't move further in this list.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await Promise.all(reordered.map((domainId, index) => tx.domain.update({ where: { id: domainId }, data: { order: index } })));
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.domain_moved",
        target: { type: "Domain", id, label: domains.find((d) => d.id === id)?.name ?? "" },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}
