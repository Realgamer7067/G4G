import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, apiHandler, requireApiPermission } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { imageUrl, toPublicImage } from "@/lib/media/public-image";
import { IMAGE_PURPOSES, type ImagePurpose } from "@/lib/media/variants";
import { parseRequestMeta } from "@/lib/request-meta";
import { uploadLimiter } from "@/lib/security/limiters";
import { saveImage } from "@/server/media/save-image";

const MAX_BYTES = 15 * 1024 * 1024;

const cropSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const POST = apiHandler(async (req: Request) => {
  const user = await requireApiPermission(req, "media.upload");
  if (!uploadLimiter.check(user.id).allowed) {
    throw new ApiError(429, "You're uploading very quickly. Wait a minute and try again.");
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    throw new ApiError(413, "Images must be 15 MB or smaller.");
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Choose an image to upload.");
  if (file.size > MAX_BYTES) throw new ApiError(413, "Images must be 15 MB or smaller.");

  const purpose = String(form.get("purpose") ?? "");
  if (!IMAGE_PURPOSES.includes(purpose as ImagePurpose)) throw new UserError("Unknown image type.");

  let crop: z.infer<typeof cropSchema> | undefined;
  const rawCrop = form.get("crop");
  if (typeof rawCrop === "string" && rawCrop) {
    const parsed = cropSchema.safeParse(JSON.parse(rawCrop));
    if (!parsed.success) throw new UserError("The crop area is invalid. Adjust the crop and try again.");
    crop = parsed.data;
  }

  const upload = await saveImage({
    buffer: Buffer.from(await file.arrayBuffer()),
    originalName: file.name,
    purpose: purpose as ImagePurpose,
    crop,
    alt: String(form.get("alt") ?? "").trim(),
    uploadedById: user.id,
  });

  await writeAuditLog(db, {
    actor: { id: user.id, name: user.name },
    action: "media.uploaded",
    target: { type: "Upload", id: upload.id, label: upload.originalName },
    metadata: { purpose: upload.purpose, width: upload.width, height: upload.height },
    meta: parseRequestMeta(req.headers),
  });

  const image = toPublicImage(upload);
  return Response.json(
    { id: upload.id, width: upload.width, height: upload.height, alt: upload.alt, url: image ? imageUrl(image, 800) : null },
    { status: 201 },
  );
});
