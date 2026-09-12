// src/lib/pages/about-schema.ts
import { z } from "zod";

export const aboutContentSchema = z.object({
  heading: z.string().trim().max(80).default(""),
  body: z.string().trim().max(4000).default(""),
  imageId: z.string().nullable().default(null),
});
export type AboutContent = z.infer<typeof aboutContentSchema>;

export const ABOUT_DEFAULTS: AboutContent = { heading: "", body: "", imageId: null };
