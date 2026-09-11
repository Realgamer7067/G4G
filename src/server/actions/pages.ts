"use server";

import { z } from "zod";
import type { PageKey } from "@/generated/prisma/enums";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { formDataToObject, isChecked } from "@/lib/forms-data";
import { PAGE_KEYS } from "@/lib/pages/registry";
import { getRequestMeta } from "@/lib/request-meta";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters.`)
    .optional()
    .transform((v) => v || null);

const rowSchema = z.object({
  // Unchecked checkboxes are not submitted at all, so these keys must be optional.
  enabled: z.unknown().optional().transform(isChecked),
  showInNav: z.unknown().optional().transform(isChecked),
  navLabel: z.string().trim().min(1, "Add a menu label.").max(30, "Keep it under 30 characters."),
  seoTitle: optionalText(70),
  seoDescription: optionalText(200),
});

const pagesSchema = z.object({
  order: z
    .array(z.enum(PAGE_KEYS as [PageKey, ...PageKey[]]))
    .refine((o) => o.length === PAGE_KEYS.length && new Set(o).size === PAGE_KEYS.length, "Page order is incomplete."),
  ...(Object.fromEntries(PAGE_KEYS.map((k) => [k, rowSchema])) as Record<PageKey, typeof rowSchema>),
});

export async function savePagesAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("pages.manage");
    const input = pagesSchema.parse(formDataToObject(formData, ["order"]));
    const meta = await getRequestMeta();

    await db.$transaction(async (tx) => {
      const before = await tx.pageSetting.findMany();
      const changes: Record<string, string[]> = {};
      for (const [navOrder, key] of input.order.entries()) {
        const row = input[key];
        const data = {
          enabled: key === "HOME" ? true : row.enabled,
          showInNav: row.showInNav,
          navLabel: row.navLabel,
          navOrder,
          seoTitle: row.seoTitle,
          seoDescription: row.seoDescription,
        };
        const prev = before.find((b) => b.key === key);
        const diff = prev ? (Object.keys(data) as (keyof typeof data)[]).filter((f) => prev[f] !== data[f]) : ["created"];
        if (diff.length) changes[key] = diff;
        await tx.pageSetting.upsert({ where: { key }, create: { key, ...data }, update: data });
      }
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "pages.updated",
        target: { type: "PageSetting", label: "Pages & navigation" },
        metadata: { changes },
        meta,
      });
    });

    invalidate(TAGS.pages);
    return null;
  });
}
