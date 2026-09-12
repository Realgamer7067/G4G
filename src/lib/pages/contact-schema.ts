// src/lib/pages/contact-schema.ts
import { z } from "zod";

export const contactContentSchema = z.object({
  intro: z.string().trim().max(500).default(""),
  showEmail: z.boolean().default(true),
  showPhone: z.boolean().default(false),
  showAddress: z.boolean().default(false),
  showMap: z.boolean().default(false),
});
export type ContactContent = z.infer<typeof contactContentSchema>;

export const CONTACT_DEFAULTS: ContactContent = { intro: "", showEmail: true, showPhone: false, showAddress: false, showMap: false };
