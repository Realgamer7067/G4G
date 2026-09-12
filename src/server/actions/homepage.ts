"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { homepageSectionsSchema, type HomepageSections } from "@/lib/homepage/sections/schema";
import { getRequestMeta } from "@/lib/request-meta";

const actorOf = (u: SessionUser) => ({ id: u.id, name: u.name });

/** Builder autosave: stores the draft if its shape is valid. */
export async function saveHomepageDraftAction(revisionId: string, sections: unknown): Promise<ActionResult<{ savedAt: string }>> {
  return runAction(async () => {
    await requirePermission("homepage.edit");
    const parsed = homepageSectionsSchema.safeParse(sections);
    if (!parsed.success) throw new UserError("Not saved yet. Check the highlighted section.");
    const { count } = await db.homepageRevision.updateMany({
      where: { id: revisionId, status: "DRAFT" },
      data: { sections: parsed.data as Prisma.InputJsonValue },
    });
    if (!count) throw new UserError("That draft no longer exists. Reload the page.");
    return { savedAt: new Date().toISOString() };
  });
}

export async function publishHomepageAction(revisionId: string): Promise<ActionResult<{ publishedAt: string }>> {
  return runAction(async () => {
    const user = await requirePermission("homepage.publish");
    const draft = await db.homepageRevision.findUnique({ where: { id: revisionId } });
    if (!draft || draft.status !== "DRAFT") throw new UserError("That draft no longer exists. Reload the page.");
    const meta = await getRequestMeta();
    const publishedAt = await db.$transaction(async (tx) => {
      await tx.homepageRevision.updateMany({ where: { status: "PUBLISHED" }, data: { status: "SUPERSEDED" } });
      const now = new Date();
      await tx.homepageRevision.create({
        data: { status: "PUBLISHED", sections: draft.sections as Prisma.InputJsonValue, publishedAt: now, publishedById: user.id },
      });
      await writeAuditLog(tx, { actor: actorOf(user), action: "homepage.published", target: { type: "HomepageRevision", id: revisionId, label: "Homepage" }, meta });
      return now;
    });
    invalidate(TAGS.homepage);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    return { publishedAt: publishedAt.toISOString() };
  });
}

/** Copies an old PUBLISHED/SUPERSEDED revision's sections back into the current draft, for review before re-publishing. */
export async function restoreHomepageRevisionAction(revisionId: string, historyId: string): Promise<ActionResult<{ sections: HomepageSections }>> {
  return runAction(async () => {
    const user = await requirePermission("homepage.edit");
    const historic = await db.homepageRevision.findUnique({ where: { id: historyId } });
    if (!historic || historic.status === "DRAFT") throw new UserError("That revision no longer exists.");
    const sections = homepageSectionsSchema.parse(historic.sections);
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      const { count } = await tx.homepageRevision.updateMany({
        where: { id: revisionId, status: "DRAFT" },
        data: { sections: sections as Prisma.InputJsonValue },
      });
      if (!count) throw new UserError("That draft no longer exists. Reload the page.");
      await writeAuditLog(tx, { actor: actorOf(user), action: "homepage.restored", target: { type: "HomepageRevision", id: historyId, label: "Homepage" }, meta });
    });
    revalidatePath("/admin/homepage");
    return { sections };
  });
}
