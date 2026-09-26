// src/lib/announcements/schema.ts
import { z } from "zod";
import { isChecked } from "@/lib/forms-data";
import { isHttpUrl } from "@/lib/settings/schema";
import { isLocalDateTime } from "@/lib/utils/timezone";

export const ANNOUNCEMENT_PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<(typeof ANNOUNCEMENT_PRIORITIES)[number], string> = {
  NORMAL: "Normal",
  IMPORTANT: "Important",
  URGENT: "Urgent",
};

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const nullableText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => v || null);
const nullableId = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);
const localDateTime = (label: string) =>
  z
    .string({ error: `Pick the ${label}.` })
    .trim()
    .refine((v) => v.includes("T") && isLocalDateTime(v), `Pick the ${label}.`);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || isHttpUrl(v), "Use a full link that starts with https://.");

export const announcementFormSchema = z
  .object({
    id: nullableId,
    title: text(160).min(3, "Give the announcement a title."),
    slug: text(80).optional().default(""),
    summary: text(240).default(""),
    content: z.string().max(20_000, "The content is too long.").default(""),
    publishAt: localDateTime("publish date and time"),
    expiresAt: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || (v.includes("T") && isLocalDateTime(v)), "Pick a date and time."),
    linkUrl: optionalUrl,
    linkLabel: nullableText(40),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).default("NORMAL"),
    pinned: z.unknown().optional().transform(isChecked),
    showOnHomepage: z.unknown().optional().transform(isChecked),
    showAsBanner: z.unknown().optional().transform(isChecked),
  })
  .superRefine((val, ctx) => {
    if (val.expiresAt && val.expiresAt <= val.publishAt) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Must be after the publish date." });
    }
  });

export type AnnouncementFormInput = z.infer<typeof announcementFormSchema>;
