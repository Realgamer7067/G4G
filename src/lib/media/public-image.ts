import { z } from "zod";
import { mediaUrl } from "./urls";
import { pickFallback, type VariantFile } from "./variants";

/** JSON-safe image description passed from the data layer to components. */
export type PublicImage = {
  id: string;
  storageKey: string;
  width: number;
  height: number;
  alt: string;
  blurDataUrl: string | null;
  variants: VariantFile[];
};

const variantsSchema = z.array(
  z.object({
    name: z.string(),
    file: z.string(),
    width: z.number(),
    height: z.number(),
    format: z.enum(["avif", "webp", "jpeg", "png"]),
    bytes: z.number(),
  }),
);

type UploadLike = {
  id: string;
  storageKey: string;
  width: number | null;
  height: number | null;
  alt: string;
  blurDataUrl: string | null;
  variants: unknown;
  visibility?: string;
};

export function toPublicImage(upload: UploadLike | null | undefined): PublicImage | null {
  if (!upload || upload.visibility === "PRIVATE") return null;
  const variants = variantsSchema.safeParse(upload.variants);
  if (!variants.success || variants.data.length === 0 || !upload.width || !upload.height) return null;
  return {
    id: upload.id,
    storageKey: upload.storageKey,
    width: upload.width,
    height: upload.height,
    alt: upload.alt,
    blurDataUrl: upload.blurDataUrl,
    variants: variants.data,
  };
}

/** Select the fields `toPublicImage` needs. */
export const publicImageSelect = {
  id: true,
  storageKey: true,
  width: true,
  height: true,
  alt: true,
  blurDataUrl: true,
  variants: true,
  visibility: true,
} as const;

export function imageUrl(image: PublicImage, minWidth = 0): string {
  const candidates = image.variants
    .filter((v) => v.name !== "og" && (v.format === "webp" || v.format === "png"))
    .sort((a, b) => a.width - b.width);
  const pick = candidates.find((v) => v.width >= minWidth) ?? candidates.at(-1) ?? pickFallback(image.variants);
  return mediaUrl(image.storageKey, pick.file);
}

/** Social-preview image: the dedicated JPEG when present, otherwise the largest fallback. */
export function ogImage(image: PublicImage): { url: string; width: number; height: number } {
  const og = image.variants.find((v) => v.name === "og") ?? pickFallback(image.variants);
  return { url: mediaUrl(image.storageKey, og.file), width: og.width, height: og.height };
}
