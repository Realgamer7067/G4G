"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { announcementFormSchema } from "@/lib/announcements/schema";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { sanitizeRichText } from "@/lib/content/sanitize";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request-meta";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { zonedToUtc } from "@/lib/utils/timezone";

function uniqueAnnouncementSlug(base: string, excludeId: string | null): Promise<string> {
  return uniqueSlug(base || "announcement", async (candidate) => {
    const hit = await db.announcement.findUnique({ where: { slug: candidate }, select: { id: true } });
    return Boolean(hit && hit.id !== excludeId);
  });
}

export async function saveAnnouncementAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("announcements.manage");
    const input = announcementFormSchema.parse(Object.fromEntries(formData));
    const existing = input.id ? await db.announcement.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That announcement no longer exists.");

    const { timezone } = await loadSiteSettings();
    const slug = await uniqueAnnouncementSlug(slugify(input.slug || input.title), input.id);
    const data = {
      title: input.title,
      slug,
      summary: input.summary,
      content: sanitizeRichText(input.content),
      publishAt: zonedToUtc(input.publishAt, timezone),
      expiresAt: input.expiresAt ? zonedToUtc(input.expiresAt, timezone) : null,
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel,
      priority: input.priority,
      pinned: input.pinned,
      showOnHomepage: input.showOnHomepage,
      showAsBanner: input.showAsBanner,
    };

    const meta = await getRequestMeta();
    const saved = await db.$transaction(async (tx) => {
      const row = existing
        ? await tx.announcement.update({ where: { id: existing.id }, data })
        : await tx.announcement.create({ data: { ...data, createdById: user.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "announcement.updated" : "announcement.created",
        target: { type: "Announcement", id: row.id, label: row.title },
        meta,
      });
      return row;
    });

    invalidate(TAGS.announcements, TAGS.homepage);
    revalidatePath("/admin/announcements");
    if (!existing) createdId = saved.id;
    return { id: saved.id };
  });
  if (createdId) redirect(`/admin/announcements/${createdId}?created=1`);
  return result;
}

export async function setAnnouncementStatusAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("announcements.manage");
    const announcement = await db.announcement.findUnique({ where: { id: String(formData.get("id") ?? "") } });
    if (!announcement) throw new UserError("That announcement no longer exists.");
    const to = String(formData.get("to") ?? "");
    if (to !== "DRAFT" && to !== "PUBLISHED") throw new UserError("That change isn't possible.");
    if (to === announcement.status) throw new UserError("That announcement is already in that state.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.announcement.update({ where: { id: announcement.id }, data: { status: to } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: to === "PUBLISHED" ? "announcement.published" : "announcement.unpublished",
        target: { type: "Announcement", id: announcement.id, label: announcement.title },
        meta,
      });
    });
    invalidate(TAGS.announcements, TAGS.homepage);
    revalidatePath("/admin/announcements");
    revalidatePath(`/admin/announcements/${announcement.id}`);
    return null;
  });
}

export async function deleteAnnouncementAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("announcements.manage");
    const announcement = await db.announcement.findUnique({ where: { id: String(formData.get("id") ?? "") } });
    if (!announcement) throw new UserError("That announcement no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.announcement.delete({ where: { id: announcement.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "announcement.deleted",
        target: { type: "Announcement", id: announcement.id, label: announcement.title },
        meta,
      });
    });
    invalidate(TAGS.announcements, TAGS.homepage);
    return null;
  });
  if (result.ok) redirect("/admin/announcements?deleted=1");
  return result;
}
