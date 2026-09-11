import "server-only";
import type { ContentImage } from "@/components/forms/form-wizard";
import { db } from "@/lib/db";
import type { FormDefinition } from "@/lib/forms/engine/schema";
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";

/** Public image data for every content-image block's `uploadId`, keyed by upload id. Shared by the public renderer and the builder's live preview. */
export async function resolveContentImages(definition: FormDefinition): Promise<Record<string, ContentImage>> {
  const ids = [
    ...new Set(definition.pages.flatMap((p) => p.blocks).flatMap((b) => (b.kind === "content" && b.type === "image" && b.uploadId ? [b.uploadId] : []))),
  ];
  if (ids.length === 0) return {};
  const uploads = await db.upload.findMany({ where: { id: { in: ids } }, select: publicImageSelect });
  const images: Record<string, ContentImage> = {};
  for (const u of uploads) {
    const img = toPublicImage(u);
    if (!img) continue;
    const width = Math.min(1200, img.width);
    images[u.id] = { url: imageUrl(img, 1200), width, height: Math.round((width * img.height) / img.width), alt: img.alt };
  }
  return images;
}
