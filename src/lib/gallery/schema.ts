import { z } from "zod";

export const albumFormSchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((v) => v || null),
  title: z.string().trim().min(1, "Give the album a title.").max(100),
  description: z.string().trim().max(500).default(""),
  date: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date."),
  eventId: z
    .string()
    .nullish()
    .transform((v) => v || null),
  isPublished: z.unknown().optional(),
});
export type AlbumFormInput = z.infer<typeof albumFormSchema>;

/** ISO date (YYYY-MM-DD) -> UTC midnight, for the date-only <input type="date">. */
export function parseAlbumDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

/** Formats a stored album date back to the <input type="date"> value. */
export function formatAlbumDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export const captionSchema = z.object({
  imageId: z.string().min(1),
  caption: z.string().trim().max(200).default(""),
});

export const bulkAddImageSchema = z.object({
  uploadId: z.string().min(1),
  alt: z.string().trim().min(1, "Every photo needs alt text.").max(300),
});
export const bulkAddImagesSchema = z.array(bulkAddImageSchema).min(1, "Add at least one photo.").max(60);
