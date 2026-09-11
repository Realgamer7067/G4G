import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { UserError } from "@/lib/errors";
import { processImage } from "./process-image";

function makeImage(width: number, height: number, format: "jpeg" | "png" = "jpeg") {
  const img = sharp({ create: { width, height, channels: 3, background: { r: 47, g: 141, b: 70 } } });
  return (format === "jpeg" ? img.jpeg() : img.png()).toBuffer();
}

async function metaOf(buffer: Buffer) {
  return sharp(buffer).metadata();
}

describe("processImage", () => {
  it("normalises a poster to 1600×900 and produces every variant", async () => {
    const result = await processImage(await makeImage(1920, 1080), "POSTER");
    expect([result.width, result.height]).toEqual([1600, 900]);
    expect(result.files.map((f) => f.file)).toEqual([
      "w400.avif", "w400.webp", "w800.avif", "w800.webp",
      "w1200.avif", "w1200.webp", "w1600.avif", "w1600.webp", "og.jpg",
    ]);
    const og = result.files.find((f) => f.name === "og")!;
    expect(await metaOf(og.buffer)).toMatchObject({ format: "jpeg", width: 1200, height: 675 });
    const w800 = result.files.find((f) => f.file === "w800.webp")!;
    expect(await metaOf(w800.buffer)).toMatchObject({ format: "webp", width: 800, height: 450 });
    expect(result.blurDataUrl.startsWith("data:image/webp;base64,")).toBe(true);
    expect(result.original.file).toBe("original.jpg");
  });

  it("centre-crops to the purpose's aspect ratio when no crop is given", async () => {
    const result = await processImage(await makeImage(2000, 1600), "POSTER");
    expect([result.width, result.height]).toEqual([1600, 900]);
  });

  it("honours an explicit crop and never upscales", async () => {
    const result = await processImage(await makeImage(2000, 2000), "POSTER", { x: 100, y: 200, width: 1280, height: 720 });
    expect([result.width, result.height]).toEqual([1280, 720]);
    expect(result.files.map((f) => f.file)).not.toContain("w1600.webp");
  });

  it("rejects posters that are too small", async () => {
    await expect(processImage(await makeImage(800, 450), "POSTER")).rejects.toThrow(
      "This image is 800 × 450. Posters need at least 960 × 540.",
    );
  });

  it("rejects crops outside the image", async () => {
    await expect(
      processImage(await makeImage(1000, 1000), "TEAM", { x: 900, y: 0, width: 400, height: 400 }),
    ).rejects.toBeInstanceOf(UserError);
  });

  it("rejects SVG and non-image bytes", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000"><rect width="2000" height="2000"/></svg>');
    await expect(processImage(svg, "GENERIC")).rejects.toThrow("Upload a JPG, PNG, WebP or AVIF image.");
    await expect(processImage(Buffer.from("definitely not an image"), "GENERIC")).rejects.toThrow(
      "Upload a JPG, PNG, WebP or AVIF image.",
    );
  });

  it("strips EXIF metadata", async () => {
    const withExif = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#fff" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "private", Artist: "someone" } })
      .toBuffer();
    expect((await metaOf(withExif)).exif).toBeDefined();
    const result = await processImage(withExif, "GALLERY");
    for (const f of [result.original, ...result.files]) expect((await metaOf(f.buffer)).exif).toBeUndefined();
  });

  it("applies camera orientation before measuring", async () => {
    const rotated = await sharp({ create: { width: 800, height: 400, channels: 3, background: "#000" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await processImage(rotated, "GENERIC");
    expect([result.width, result.height]).toEqual([400, 800]);
  });

  it("keeps PNG transparency for logos", async () => {
    const logo = await sharp({ create: { width: 600, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .png()
      .toBuffer();
    const result = await processImage(logo, "LOGO");
    const png = result.files.find((f) => f.format === "png")!;
    expect((await metaOf(png.buffer)).hasAlpha).toBe(true);
  });
});
