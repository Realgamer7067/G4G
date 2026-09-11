"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { SPONSOR_TIERS } from "@/lib/events/schema";
import { isChecked } from "@/lib/forms-data";
import { getRequestMeta } from "@/lib/request-meta";
import { isHttpUrl } from "@/lib/settings/schema";
import { ensureImages, updateImageAlt } from "@/server/media/images";

const sponsorSchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((v) => v || null),
  name: z.string().trim().min(1, "Enter the sponsor's name.").max(80),
  logoId: z
    .string()
    .nullish()
    .transform((v) => v || null),
  website: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || isHttpUrl(v), "Use a full link that starts with https://."),
  description: z.string().trim().max(300, "Keep it under 300 characters.").default(""),
  tier: z.enum(SPONSOR_TIERS).default("PARTNER"),
  customLabel: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || null),
  showOnSponsorsPage: z.unknown().optional().transform(isChecked),
  isActive: z.unknown().optional().transform(isChecked),
  order: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(9999)),
});

export async function saveSponsorAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("sponsors.manage");
    const input = sponsorSchema.parse(Object.fromEntries(formData));
    const existing = input.id ? await db.sponsor.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That sponsor no longer exists.");
    const { id: _id, ...data } = input;
    const meta = await getRequestMeta();
    const sponsor = await db.$transaction(async (tx) => {
      await ensureImages(tx, [input.logoId]);
      const saved = existing ? await tx.sponsor.update({ where: { id: existing.id }, data }) : await tx.sponsor.create({ data });
      await updateImageAlt(tx, input.logoId, formData.get("logoIdAlt"));
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "sponsor.updated" : "sponsor.created",
        target: { type: "Sponsor", id: saved.id, label: saved.name },
        meta,
      });
      return saved;
    });
    invalidate(TAGS.sponsors, TAGS.events);
    revalidatePath("/admin/sponsors");
    if (!existing) createdId = sponsor.id;
    return null;
  });
  if (createdId) redirect(`/admin/sponsors/${createdId}?created=1`);
  return result;
}

export async function deleteSponsorAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("sponsors.manage");
    const sponsor = await db.sponsor.findUnique({ where: { id: String(formData.get("id") ?? "") }, include: { _count: { select: { events: true } } } });
    if (!sponsor) throw new UserError("That sponsor no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.sponsor.delete({ where: { id: sponsor.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "sponsor.deleted",
        target: { type: "Sponsor", id: sponsor.id, label: sponsor.name },
        metadata: { removedFromEvents: sponsor._count.events },
        meta,
      });
    });
    invalidate(TAGS.sponsors, TAGS.events);
    return null;
  });
  if (result.ok) redirect("/admin/sponsors?deleted=1");
  return result;
}
