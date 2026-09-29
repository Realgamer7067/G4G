import { describe, expect, it } from "vitest";
import { PURPOSE_RULES, pickFallback, planVariants, validateDimensions, type VariantFile } from "./variants";

const dims = (specs: { width: number; height: number; format: string }[]) =>
  specs.map((s) => `${s.width}x${s.height}.${s.format}`);

describe("planVariants", () => {
  it("builds the full poster set plus a 1200×675 JPEG for social previews", () => {
    expect(dims(planVariants("POSTER", 1600, 900))).toEqual([
      "400x225.avif", "400x225.webp",
      "800x450.avif", "800x450.webp",
      "1200x675.avif", "1200x675.webp",
      "1600x900.avif", "1600x900.webp",
      "1200x675.jpeg",
    ]);
  });

  it("names files by width and format", () => {
    const specs = planVariants("POSTER", 1600, 900);
    expect(specs[0]).toMatchObject({ name: "w400", file: "w400.avif" });
    expect(specs.at(-1)).toMatchObject({ name: "og", file: "og.jpg" });
  });

  it("never upscales: small posters keep only widths they can fill", () => {
    expect(dims(planVariants("POSTER", 1000, 563))).toEqual([
      "400x225.avif", "400x225.webp",
      "800x450.avif", "800x450.webp",
      "1000x563.jpeg",
    ]);
  });

  it("caps gallery photos by their longest edge", () => {
    expect(dims(planVariants("GALLERY", 3000, 4000))).toEqual([
      "480x640.avif", "480x640.webp",
      "960x1280.avif", "960x1280.webp",
      "1600x2133.avif", "1600x2133.webp",
    ]);
  });

  it("keeps one variant at the source size when the image is smaller than every width", () => {
    expect(dims(planVariants("GALLERY", 300, 200))).toEqual(["300x200.avif", "300x200.webp"]);
  });

  it("keeps transparency-friendly formats for logos", () => {
    expect(dims(planVariants("LOGO", 500, 250))).toEqual([
      "200x100.webp", "200x100.png",
      "400x200.webp", "400x200.png",
    ]);
  });
});

describe("validateDimensions", () => {
  it("accepts a correctly sized poster", () => {
    expect(validateDimensions("POSTER", 1920, 1080)).toBeNull();
  });
  it("explains when a poster is too small", () => {
    expect(validateDimensions("POSTER", 800, 450)).toBe("This image is 800 × 450. Posters need a shortest side of at least 540px.");
  });
  it("accepts square and portrait posters", () => {
    expect(validateDimensions("POSTER", 1080, 1080)).toBeNull();
    expect(validateDimensions("POSTER", 2480, 3508)).toBeNull();
  });
  it("checks square photos", () => {
    expect(validateDimensions("TEAM", 150, 150)).toBe("This image is 150 × 150. Team photos need at least 200 × 200.");
  });
  it("checks the shortest side for free-form photos", () => {
    expect(validateDimensions("GALLERY", 1000, 200)).toBe(
      "This image is 1000 × 200. Gallery photos need a shortest side of at least 320px.",
    );
    expect(validateDimensions("GALLERY", 320, 1000)).toBeNull();
  });
  it("describes every purpose for the upload field", () => {
    for (const rule of Object.values(PURPOSE_RULES)) expect(rule.recommended.length).toBeGreaterThan(10);
  });
});

describe("pickFallback", () => {
  const v = (width: number, format: VariantFile["format"]): VariantFile => ({
    name: `w${width}`, file: `w${width}.${format}`, width, height: width, format, bytes: 1,
  });
  it("prefers the largest WebP", () => {
    expect(pickFallback([v(400, "webp"), v(1600, "avif"), v(1600, "webp"), v(800, "webp")]).file).toBe("w1600.webp");
  });
  it("falls back to PNG when there is no WebP", () => {
    expect(pickFallback([v(200, "png"), v(400, "png")]).file).toBe("w400.png");
  });
});
