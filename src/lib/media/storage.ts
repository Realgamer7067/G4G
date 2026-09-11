import { randomUUID } from "node:crypto";
import path from "node:path";

export function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
}

/** Public and private files live in separate trees so `/media` can only ever serve the public one. */
export function visibilityRoot(visibility: "PUBLIC" | "PRIVATE"): string {
  return path.join(uploadRoot(), visibility === "PUBLIC" ? "public" : "private");
}

export function newStorageKey(now: Date = new Date(), id: string = randomUUID()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}/${month}/${id}`;
}

/** Joins path parts under `root`, returning null if the result would escape it. */
export function resolveInside(root: string, ...parts: string[]): string | null {
  if (parts.some((p) => p.includes("\\") || path.isAbsolute(p))) return null;
  const resolved = path.resolve(root, ...parts);
  const rel = path.relative(root, resolved);
  if (!rel || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return resolved;
}

const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  pdf: "application/pdf",
  zip: "application/zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function contentTypeFor(file: string): string {
  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export { mediaUrl } from "./urls";
