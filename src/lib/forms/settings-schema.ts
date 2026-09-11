import { z } from "zod";
import { isChecked } from "@/lib/forms-data";
import { isLocalDateTime } from "@/lib/utils/timezone";

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const optionalLocal = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || (v.includes("T") && isLocalDateTime(v)), "Pick a date and time.");

export const formSettingsSchema = z
  .object({
    id: z.string().min(1),
    name: text(120).min(2, "Name the form."),
    slug: text(80).default(""),
    description: text(1_000).default(""),
    coverId: z
      .string()
      .nullish()
      .transform((v) => v || null),
    visibility: z.enum(["PUBLIC_LINK", "EVENT_ONLY"]).default("PUBLIC_LINK"),
    acceptingResponses: z.unknown().optional().transform(isChecked),
    opensAt: optionalLocal,
    closesAt: optionalLocal,
    maxResponses: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
      z.number({ error: "Enter a number." }).int("Use a whole number.").min(1, "Use at least 1.").max(1_000_000).nullable(),
    ),
    oneResponsePerEmail: z.unknown().optional().transform(isChecked),
    successMessage: text(500).min(1, "Add a message people see after submitting."),
    submitLabel: text(40).min(1, "Add a label for the submit button."),
    reviewStep: z.unknown().optional().transform(isChecked),
  })
  .superRefine((v, ctx) => {
    if (v.opensAt && v.closesAt && v.closesAt <= v.opensAt) {
      ctx.addIssue({ code: "custom", path: ["closesAt"], message: "The closing time must be after the opening time." });
    }
  });
