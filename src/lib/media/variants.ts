export type ImageFormat = "avif" | "webp" | "jpeg" | "png";

export type ImagePurpose = "POSTER" | "COVER" | "GALLERY" | "TEAM" | "AVATAR" | "LOGO" | "SPONSOR" | "GENERIC";

export const IMAGE_PURPOSES: readonly ImagePurpose[] = [
  "POSTER", "COVER", "GALLERY", "TEAM", "AVATAR", "LOGO", "SPONSOR", "GENERIC",
];

export type VariantSpec = { name: string; file: string; width: number; height: number; format: ImageFormat };
export type VariantFile = VariantSpec & { bytes: number };

type PurposeRule = {
  /** Plural noun used in messages, e.g. "Posters". */
  label: string;
  aspect?: number;
  aspectLabel?: string;
  minWidth?: number;
  minHeight?: number;
  minShortEdge?: number;
  /** Base image is scaled down to at most this width. */
  maxWidth?: number;
  /** Base image is scaled down so its longest edge fits. */
  maxEdge?: number;
  widths: number[];
  formats: ImageFormat[];
  /** Adds a JPEG for social previews (some platforms ignore WebP/AVIF). */
  og?: { width: number };
  recommended: string;
};

export const PURPOSE_RULES: Record<ImagePurpose, PurposeRule> = {
  POSTER: {
    label: "Posters", aspect: 16 / 9, aspectLabel: "16:9", minWidth: 960, minHeight: 540, maxWidth: 1600,
    widths: [400, 800, 1200, 1600], formats: ["avif", "webp"], og: { width: 1200 },
    recommended: "Landscape 16:9. Recommended 1600 × 900, minimum 960 × 540.",
  },
  COVER: {
    label: "Cover images", aspect: 16 / 9, aspectLabel: "16:9", minWidth: 960, minHeight: 540, maxWidth: 1600,
    widths: [480, 960, 1600], formats: ["avif", "webp"], og: { width: 1200 },
    recommended: "Landscape 16:9. Recommended 1600 × 900, minimum 960 × 540.",
  },
  GALLERY: {
    label: "Gallery photos", minShortEdge: 320, maxEdge: 2400,
    widths: [480, 960, 1600, 2400], formats: ["avif", "webp"],
    recommended: "Any shape. Shortest side at least 320px; large photos are resized to 2400px.",
  },
  TEAM: {
    label: "Team photos", aspect: 1, aspectLabel: "square", minWidth: 200, minHeight: 200, maxWidth: 800,
    widths: [200, 400, 800], formats: ["avif", "webp"],
    recommended: "Square photo, at least 200 × 200. 800 × 800 looks best.",
  },
  AVATAR: {
    label: "Profile pictures", aspect: 1, aspectLabel: "square", minWidth: 64, minHeight: 64, maxWidth: 256,
    widths: [64, 128, 256], formats: ["webp"],
    recommended: "Square image, at least 64 × 64.",
  },
  LOGO: {
    label: "Logos", minShortEdge: 64, maxEdge: 800,
    widths: [200, 400, 800], formats: ["webp", "png"],
    recommended: "PNG or WebP with a transparent background, at least 64px on the shortest side.",
  },
  SPONSOR: {
    label: "Sponsor logos", minShortEdge: 64, maxEdge: 800,
    widths: [200, 400, 800], formats: ["webp", "png"],
    recommended: "PNG or WebP with a transparent background, at least 64px on the shortest side.",
  },
  GENERIC: {
    label: "Images", minShortEdge: 64, maxEdge: 2400,
    widths: [480, 960, 1600], formats: ["avif", "webp"],
    recommended: "JPG, PNG, WebP or AVIF.",
  },
};

const EXTENSION: Record<ImageFormat, string> = { avif: "avif", webp: "webp", jpeg: "jpg", png: "png" };

export function extensionFor(format: ImageFormat): string {
  return EXTENSION[format];
}

/** Target size of the stored base image (after crop), never larger than the source. */
export function baseSize(purpose: ImagePurpose, width: number, height: number): { width: number; height: number } {
  const rule = PURPOSE_RULES[purpose];
  let scale = 1;
  if (rule.maxWidth) scale = Math.min(scale, rule.maxWidth / width);
  if (rule.maxEdge) scale = Math.min(scale, rule.maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function planVariants(purpose: ImagePurpose, width: number, height: number): VariantSpec[] {
  const rule = PURPOSE_RULES[purpose];
  const effective = baseSize(purpose, width, height).width;
  const widths = rule.widths.filter((w) => w <= effective);
  if (widths.length === 0) widths.push(effective);

  const specs: VariantSpec[] = [];
  for (const w of widths) {
    const h = Math.round((w * height) / width);
    for (const format of rule.formats) {
      specs.push({ name: `w${w}`, file: `w${w}.${EXTENSION[format]}`, width: w, height: h, format });
    }
  }
  if (rule.og) {
    const w = Math.min(rule.og.width, effective);
    specs.push({ name: "og", file: "og.jpg", width: w, height: Math.round((w * height) / width), format: "jpeg" });
  }
  return specs;
}

export function validateDimensions(purpose: ImagePurpose, width: number, height: number): string | null {
  const rule = PURPOSE_RULES[purpose];
  if (rule.aspect && Math.abs(width / height - rule.aspect) / rule.aspect > 0.01) {
    return `${rule.label} must be ${rule.aspectLabel}. Crop the image before uploading.`;
  }
  if (rule.minWidth && rule.minHeight && (width < rule.minWidth || height < rule.minHeight)) {
    return `This image is ${width} × ${height}. ${rule.label} need at least ${rule.minWidth} × ${rule.minHeight}.`;
  }
  if (rule.minShortEdge && Math.min(width, height) < rule.minShortEdge) {
    return `This image is ${width} × ${height}. ${rule.label} need a shortest side of at least ${rule.minShortEdge}px.`;
  }
  return null;
}

/** The `<img>` fallback: largest WebP, otherwise the largest PNG/JPEG. */
export function pickFallback(variants: readonly VariantFile[]): VariantFile {
  const byWidth = (list: readonly VariantFile[]) => [...list].sort((a, b) => b.width - a.width)[0];
  return (
    byWidth(variants.filter((v) => v.format === "webp")) ??
    byWidth(variants.filter((v) => v.format === "png" || v.format === "jpeg")) ??
    variants[0]
  );
}
