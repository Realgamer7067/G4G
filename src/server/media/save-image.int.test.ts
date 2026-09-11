import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { toPublicImage } from "@/lib/media/public-image";
import { saveImage } from "./save-image";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "gfg-uploads-"));
  process.env.UPLOAD_DIR = dir;
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const jpeg = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#2f8d46" } }).jpeg().toBuffer();

describe("saveImage", () => {
  it("writes every variant under the public tree and records the upload", async () => {
    const upload = await saveImage({
      buffer: await jpeg(1920, 1080),
      originalName: "poster.jpg",
      purpose: "POSTER",
      alt: "Code Sprint poster",
      uploadedById: null,
    });
    expect(upload).toMatchObject({ kind: "IMAGE", purpose: "POSTER", visibility: "PUBLIC", width: 1600, height: 900, alt: "Code Sprint poster" });
    const files = await readdir(path.join(dir, "public", upload.storageKey));
    expect(files.sort()).toEqual(
      ["og.jpg", "original.jpg", "w1200.avif", "w1200.webp", "w1600.avif", "w1600.webp", "w400.avif", "w400.webp", "w800.avif", "w800.webp"].sort(),
    );
    const image = toPublicImage(upload);
    expect(image?.variants).toHaveLength(9);
    expect(image?.variants.every((v) => v.bytes > 0)).toBe(true);
  });

  it("rejects bad input without leaving files or rows behind", async () => {
    await expect(
      saveImage({ buffer: Buffer.from("nope"), originalName: "x.jpg", purpose: "GALLERY", alt: "", uploadedById: null }),
    ).rejects.toBeInstanceOf(UserError);
    expect(await db.upload.count()).toBe(0);
  });

  it("removes written files when the database insert fails", async () => {
    const countFiles = async () =>
      (await readdir(path.join(dir, "public"), { recursive: true }).catch(() => [] as string[])).filter((p) => /\.(webp|avif|jpg)$/.test(p)).length;
    const before = await countFiles();
    await expect(
      saveImage({ buffer: await jpeg(800, 800), originalName: "x.jpg", purpose: "TEAM", alt: "", uploadedById: "missing-admin" }),
    ).rejects.toThrow();
    expect(await db.upload.count()).toBe(0);
    expect(await countFiles()).toBe(before);
  });
});
