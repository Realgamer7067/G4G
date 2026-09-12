"use server";

import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { formDataToObject } from "@/lib/forms-data";
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
    const input = contactContentSchema.parse(formDataToObject(formData));
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
