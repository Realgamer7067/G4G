import sharp from "sharp";
import { UserError } from "@/lib/errors";
import {
  PURPOSE_RULES,
  baseSize,
  extensionFor,
  planVariants,
  validateDimensions,
  type ImageFormat,
  type ImagePurpose,
} from "./variants";

export type CropRect = { x: number; y: number; width: number; height: number };

export type ProcessedFile = { name: string; file: string; format: ImageFormat; width: number; height: number; buffer: Buffer };

export type ProcessedImage = {
  /** Size of the stored base image (after crop and downscale). */
  width: number;
  height: number;
  files: ProcessedFile[];
  /** Orientation-corrected, metadata-free copy of the full source, kept for re-cropping later. */
  original: ProcessedFile;
  blurDataUrl: string;
};

const MAX_PIXELS = 50_000_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif"]); // AVIF reports as "heif"
const BAD_TYPE = "Upload a JPG, PNG, WebP or AVIF image.";

type Raw = { data: Buffer; width: number; height: number; channels: 1 | 2 | 3 | 4 };

function fromRaw(raw: Raw) {
  return sharp(raw.data, { raw: { width: raw.width, height: raw.height, channels: raw.channels } });
}

async function encode(raw: Raw, format: ImageFormat, width: number, height: number): Promise<Buffer> {
  let img = fromRaw(raw);
  if (width !== raw.width || height !== raw.height) img = img.resize(width, height, { fit: "fill" });
  switch (format) {
    case "avif":
      return img.avif({ quality: 50, effort: 4 }).toBuffer();
    case "webp":
      return img.webp({ quality: 78 }).toBuffer();
    case "jpeg":
      return img.flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    case "png":
      return img.png({ compressionLevel: 9 }).toBuffer();
  }
}

async function toRaw(img: ReturnType<typeof sharp>): Promise<Raw> {
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels as Raw["channels"] };
}

function centreCrop(width: number, height: number, aspect: number): CropRect {
  if (width / height > aspect) {
    const w = Math.round(height * aspect);
    return { x: Math.floor((width - w) / 2), y: 0, width: w, height };
  }
  const h = Math.round(width / aspect);
  return { x: 0, y: Math.floor((height - h) / 2), width, height: h };
}

function checkCrop(crop: CropRect, width: number, height: number): CropRect {
  const c = { x: Math.round(crop.x), y: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) };
  const inside = c.x >= 0 && c.y >= 0 && c.width >= 1 && c.height >= 1 && c.x + c.width <= width && c.y + c.height <= height;
  if (!inside) throw new UserError("The crop area is outside the image. Adjust the crop and try again.");
  return c;
}

export async function processImage(input: Buffer, purpose: ImagePurpose, crop?: CropRect): Promise<ProcessedImage> {
  const rule = PURPOSE_RULES[purpose];
  const options = { limitInputPixels: MAX_PIXELS, failOn: "error" as const };

  let format: string | undefined;
  try {
    format = (await sharp(input, options).metadata()).format;
  } catch {
    throw new UserError(BAD_TYPE);
  }
  if (!format || !ALLOWED_FORMATS.has(format)) throw new UserError(BAD_TYPE);

  // Decode once: apply camera orientation and drop all metadata by working from raw pixels.
  let oriented: Raw;
  try {
    oriented = await toRaw(sharp(input, options).rotate());
  } catch {
    throw new UserError("This image couldn't be read. Try saving it again as JPG or PNG.");
  }

  const region = crop
    ? checkCrop(crop, oriented.width, oriented.height)
    : rule.aspect
      ? centreCrop(oriented.width, oriented.height, rule.aspect)
      : { x: 0, y: 0, width: oriented.width, height: oriented.height };

  const problem = validateDimensions(purpose, region.width, region.height);
  if (problem) throw new UserError(problem);

  const size = baseSize(purpose, region.width, region.height);
  const base = await toRaw(fromRaw(oriented).extract({ left: region.x, top: region.y, width: region.width, height: region.height }).resize(size.width, size.height, { fit: "fill" }));

  const files: ProcessedFile[] = [];
  for (const spec of planVariants(purpose, base.width, base.height)) {
    files.push({ ...spec, buffer: await encode(base, spec.format, spec.width, spec.height) });
  }

  const originalFormat: ImageFormat = oriented.channels === 4 || oriented.channels === 2 ? "png" : "jpeg";
  const originalBuffer =
    originalFormat === "png"
      ? await fromRaw(oriented).png({ compressionLevel: 9 }).toBuffer()
      : await fromRaw(oriented).jpeg({ quality: 90, mozjpeg: true }).toBuffer();

  const blur = await fromRaw(base).resize(16).webp({ quality: 40 }).toBuffer();

  return {
    width: base.width,
    height: base.height,
    files,
    original: {
      name: "original",
      file: `original.${extensionFor(originalFormat)}`,
      format: originalFormat,
      width: oriented.width,
      height: oriented.height,
      buffer: originalBuffer,
    },
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}
