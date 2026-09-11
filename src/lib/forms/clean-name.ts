import path from "node:path";

/** A safe display/storage name for an uploaded file: no path, no control characters, capped length. */
export function cleanName(name: string): string {
  const base = path
    .basename(name)
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  return (base || "upload").slice(0, 200);
}
