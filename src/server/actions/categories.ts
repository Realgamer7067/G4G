"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request-meta";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

const categorySchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((v) => v || null),
  name: z.string().trim().min(2, "Name the category.").max(40, "Keep it under 40 characters."),
});

export async function saveCategoryAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("events.edit");
    const input = categorySchema.parse({ id: formData.get("id"), name: formData.get("name") });
    const existing = input.id ? await db.eventCategory.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That category no longer exists.");
    const slug = await uniqueSlug(slugify(input.name), async (s) => {
      const hit = await db.eventCategory.findUnique({ where: { slug: s }, select: { id: true } });
      return Boolean(hit && hit.id !== existing?.id);
    });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      const order = existing ? existing.order : await tx.eventCategory.count();
      const saved = existing
        ? await tx.eventCategory.update({ where: { id: existing.id }, data: { name: input.name, slug } })
        : await tx.eventCategory.create({ data: { name: input.name, slug, order } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "category.updated" : "category.created",
        target: { type: "EventCategory", id: saved.id, label: saved.name },
        meta,
      });
    });
    invalidate(TAGS.events);
    revalidatePath("/admin/events/categories");
    return null;
  });
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const user = await requirePermission("events.edit");
  const category = await db.eventCategory.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  if (!category) return;
  const meta = await getRequestMeta();
  await db.$transaction(async (tx) => {
    await tx.eventCategory.delete({ where: { id: category.id } });
    await writeAuditLog(tx, {
      actor: { id: user.id, name: user.name },
      action: "category.deleted",
      target: { type: "EventCategory", id: category.id, label: category.name },
      meta,
    });
  });
  invalidate(TAGS.events);
  revalidatePath("/admin/events/categories");
}
