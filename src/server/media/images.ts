import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { UserError } from "@/lib/errors";

type Tx = Pick<Prisma.TransactionClient, "upload">;

/** Makes sure every referenced upload is a public image that still exists. */
export async function ensureImages(tx: Tx, ids: readonly (string | null | undefined)[]): Promise<void> {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  if (wanted.length === 0) return;
  const found = await tx.upload.count({ where: { id: { in: wanted }, kind: "IMAGE", visibility: "PUBLIC" } });
  if (found !== wanted.length) throw new UserError("One of the images is no longer available. Upload it again.");
}

/** Saves alt text typed next to an image field (`<name>Alt`). */
export async function updateImageAlt(tx: Tx, id: string | null | undefined, alt: FormDataEntryValue | null): Promise<void> {
  if (!id || typeof alt !== "string") return;
  await tx.upload.update({ where: { id }, data: { alt: alt.trim().slice(0, 300) } });
}
