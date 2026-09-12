"use server";

import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { formDataToObject, isChecked } from "@/lib/forms-data";
import { aboutContentSchema } from "@/lib/pages/about-schema";
import { contactContentSchema } from "@/lib/pages/contact-schema";
import { getRequestMeta } from "@/lib/request-meta";

export async function saveAboutContentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("pages.manage");
    const input = aboutContentSchema.parse(formDataToObject(formData));
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.pageSetting.upsert({
        where: { key: "ABOUT" },
        create: { key: "ABOUT", navLabel: "About", content: input as Prisma.InputJsonValue },
        update: { content: input as Prisma.InputJsonValue },
      });
      await writeAuditLog(tx, { actor: { id: user.id, name: user.name }, action: "pages.about_updated", target: { type: "PageSetting", id: "ABOUT", label: "About page" }, meta });
    });
    invalidate(TAGS.pages);
    return null;
  });
}

export async function saveContactContentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("pages.manage");
    const raw = formDataToObject(formData);
    // Unchecked checkboxes are not submitted at all, so coerce each one explicitly before
    // parsing — otherwise a genuinely unchecked box is indistinguishable from "not provided"
    // and the schema's own default (true for showEmail) would win, making it impossible to
    // ever persist showEmail: false.
    const input = contactContentSchema.parse({
      ...raw,
      showEmail: isChecked(raw.showEmail),
      showPhone: isChecked(raw.showPhone),
      showAddress: isChecked(raw.showAddress),
      showMap: isChecked(raw.showMap),
    });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.pageSetting.upsert({
        where: { key: "CONTACT" },
        create: { key: "CONTACT", navLabel: "Contact", content: input as Prisma.InputJsonValue },
        update: { content: input as Prisma.InputJsonValue },
      });
      await writeAuditLog(tx, { actor: { id: user.id, name: user.name }, action: "pages.contact_updated", target: { type: "PageSetting", id: "CONTACT", label: "Contact page" }, meta });
    });
    invalidate(TAGS.pages);
    return null;
  });
}
