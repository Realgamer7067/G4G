import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileTypeFromBuffer } from "file-type";
import type { Prisma, Upload } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { cleanName } from "@/lib/forms/clean-name";
import type { FILE_KINDS } from "@/lib/forms/engine/schema";
import { newStorageKey, resolveInside, visibilityRoot } from "@/lib/media/storage";
import { deleteUploadFiles } from "@/server/media/save-image";

export type FileKind = (typeof FILE_KINDS)[number];

const KIND_BY_MIME: Record<string, { kind: FileKind; ext: string }> = {
  "application/pdf": { kind: "pdf", ext: "pdf" },
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/webp": { kind: "image", ext: "webp" },
  "application/x-cfb": { kind: "doc", ext: "doc" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "doc", ext: "docx" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { kind: "slides", ext: "pptx" },
  "application/zip": { kind: "zip", ext: "zip" },
};

export const FILE_KIND_LABELS: Record<FileKind, string> = { pdf: "PDF", image: "image (PNG, JPG, WebP)", doc: "Word document", slides: "PowerPoint", zip: "ZIP" };

export const CLAIM_WINDOW_MS = 24 * 3_600_000;

/** Identify a file by its bytes (never by name or declared type). */
export async function detectFileKind(buffer: Buffer): Promise<{ kind: FileKind; mime: string; ext: string } | null> {
  const type = await fileTypeFromBuffer(buffer);
  if (!type) return null;
  const known = KIND_BY_MIME[type.mime];
  return known ? { ...known, mime: type.mime } : null;
}

/** Stores a respondent's file in the PRIVATE tree. It stays unattached until a submission claims it. */
export async function saveFormFile(input: { buffer: Buffer; originalName: string; allowed: FileKind[]; maxBytes: number }): Promise<Upload> {
  if (input.buffer.length > input.maxBytes) {
    throw new UserError(`Files must be ${Math.round(input.maxBytes / 1_048_576)} MB or smaller.`);
  }
  const detected = await detectFileKind(input.buffer);
  if (!detected || !input.allowed.includes(detected.kind)) {
    throw new UserError(`Upload a ${input.allowed.map((k) => FILE_KIND_LABELS[k]).join(" or ")}.`);
  }
  const root = visibilityRoot("PRIVATE");
  const storageKey = newStorageKey();
  const dir = resolveInside(root, storageKey);
  const target = resolveInside(root, storageKey, `file.${detected.ext}`);
  if (!dir || !target) throw new Error("Invalid storage key");
  await mkdir(dir, { recursive: true });
  try {
    await writeFile(target, input.buffer);
    return await db.upload.create({
      data: {
        kind: "FILE",
        purpose: "FORM_FILE",
        visibility: "PRIVATE",
        originalName: cleanName(input.originalName),
        mimeType: detected.mime,
        sizeBytes: input.buffer.length,
        storageKey,
        variants: [{ name: "file", file: `file.${detected.ext}`, width: 0, height: 0, format: detected.ext, bytes: input.buffer.length }],
      },
    });
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
}

/** Attaches freshly uploaded files to a response. Old, foreign or already-claimed uploads are refused. */
export async function claimFormFiles(tx: Prisma.TransactionClient, ids: string[], responseId: string, now: Date = new Date()): Promise<void> {
  if (ids.length === 0) return;
  const { count } = await tx.upload.updateMany({
    where: {
      id: { in: ids },
      purpose: "FORM_FILE",
      formResponseId: null,
      createdAt: { gt: new Date(now.getTime() - CLAIM_WINDOW_MS) },
    },
    data: { formResponseId: responseId },
  });
  if (count !== ids.length) throw new UserError("One of your uploads expired. Upload it again.");
}

export function privateFilePath(upload: Pick<Upload, "storageKey" | "mimeType">): string | null {
  const ext = Object.entries(KIND_BY_MIME).find(([mime]) => mime === upload.mimeType)?.[1].ext;
  return ext ? resolveInside(visibilityRoot("PRIVATE"), upload.storageKey, `file.${ext}`) : null;
}

/**
 * Removes respondent files that were uploaded but never attached to a submission (the form was abandoned).
 * They can no longer be claimed after CLAIM_WINDOW_MS, so anything older than twice that is dead personal data.
 */
export async function pruneUnclaimedFormFiles(now: Date = new Date(), limit = 50): Promise<number> {
  const cutoff = new Date(now.getTime() - 2 * CLAIM_WINDOW_MS);
  const stale = await db.upload.findMany({
    where: { purpose: "FORM_FILE", formResponseId: null, createdAt: { lt: cutoff } },
    select: { id: true, storageKey: true, visibility: true },
    take: limit,
  });
  if (stale.length === 0) return 0;
  const { count } = await db.upload.deleteMany({ where: { id: { in: stale.map((u) => u.id) }, formResponseId: null } });
  await Promise.all(stale.map((u) => deleteUploadFiles(u)));
  return count;
}
