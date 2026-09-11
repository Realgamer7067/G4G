"use server";

import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { formDataToObject } from "@/lib/forms-data";
import { getRequestMeta } from "@/lib/request-meta";
import { siteSettingsFormSchema } from "@/lib/settings/schema";
import { ensureImages, updateImageAlt } from "@/server/media/images";

export async function updateSiteSettingsAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("settings.manage");
    const input = siteSettingsFormSchema.parse(formDataToObject(formData, ["socials.custom", "footer.columns"]));
    const meta = await getRequestMeta();

    const data = {
      clubName: input.clubName,
      shortName: input.shortName,
      tagline: input.tagline,
      description: input.description,
      universityName: input.universityName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      mapUrl: input.mapUrl,
      timezone: input.timezone,
      logoId: input.logoId,
      socials: input.socials,
      footer: input.footer,
      seo: input.seo,
      navCtas: input.navCta ? [input.navCta] : [],
    };

    await db.$transaction(async (tx) => {
      await ensureImages(tx, [input.logoId, input.seo.ogImageId]);
      const before = await tx.siteSettings.findUnique({ where: { id: 1 } });
      await tx.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      await updateImageAlt(tx, input.logoId, formData.get("logoIdAlt"));
      await updateImageAlt(tx, input.seo.ogImageId, formData.get("seo.ogImageIdAlt"));
      const changed = Object.keys(data).filter(
        (k) => JSON.stringify(before?.[k as keyof typeof before] ?? null) !== JSON.stringify(data[k as keyof typeof data]),
      );
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "settings.updated",
        target: { type: "SiteSettings", id: "1", label: "Site settings" },
        metadata: { changed },
        meta,
      });
    });

    invalidate(TAGS.site);
    return null;
  });
}
