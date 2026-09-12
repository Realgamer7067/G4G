// src/lib/pages/contact-schema.ts
import { z } from "zod";
import { isChecked } from "@/lib/forms-data";

export const contactContentSchema = z.object({
  intro: z.string().trim().max(500).default(""),
  // Unchecked checkboxes are not submitted at all, so these keys must be optional.
  // showEmail defaults to true when the key is entirely absent (e.g. brand-new content);
  // the other three naturally default to false via isChecked(undefined).
  showEmail: z.unknown().optional().transform(isChecked).default(true),
  showPhone: z.unknown().optional().transform(isChecked),
  showAddress: z.unknown().optional().transform(isChecked),
  showMap: z.unknown().optional().transform(isChecked),
});
export type ContactContent = z.infer<typeof contactContentSchema>;

export const CONTACT_DEFAULTS: ContactContent = { intro: "", showEmail: true, showPhone: false, showAddress: false, showMap: false };
