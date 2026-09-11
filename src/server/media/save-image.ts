import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import type { Upload } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { processImage, type CropRect } from "@/lib/media/process-image";
import { contentTypeFor, newStorageKey, resolveInside, visibilityRoot } from "@/lib/media/storage";
import type { ImagePurpose, VariantFile } from "@/lib/media/variants";

export async function saveImage(input: {
  buffer: Buffer;
  originalName: string;
  purpose: ImagePurpose;
  crop?: CropRect;
  alt: string;
  uploadedById: string | null;
}): Promise<Upload> {
  const processed = await processImage(input.buffer, input.purpose, input.crop);
  const root = visibilityRoot("PUBLIC");
  const storageKey = newStorageKey();
  const dir = resolveInside(root, storageKey);
  if (!dir) throw new Error("Invalid storage key");

  await mkdir(dir, { recursive: true });
  try {
    for (const f of [...processed.files, processed.original]) {
      const target = resolveInside(root, storageKey, f.file);
      if (!target) throw new Error("Invalid variant file name");
      await writeFile(target, f.buffer);
    }
    const variants: VariantFile[] = processed.files.map(({ buffer, ...spec }) => ({ ...spec, bytes: buffer.length }));
    return await db.upload.create({
      data: {
        kind: "IMAGE",
        purpose: input.purpose,
        visibility: "PUBLIC",
        originalName: input.originalName.slice(0, 255) || "image",
        mimeType: contentTypeFor(processed.original.file),
        sizeBytes: input.buffer.length,
        width: processed.width,
        height: processed.height,
        storageKey,
        variants,
        blurDataUrl: processed.blurDataUrl,
        alt: input.alt.slice(0, 300),
        uploadedById: input.uploadedById,
      },
    });
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

/** Removes an upload's files from disk (the DB row is deleted by the caller). */
export async function deleteUploadFiles(upload: Pick<Upload, "storageKey" | "visibility">): Promise<void> {
  const dir = resolveInside(visibilityRoot(upload.visibility), upload.storageKey);
  if (dir) await rm(dir, { recursive: true, force: true });
}
