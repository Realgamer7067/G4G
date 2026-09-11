import type { PublicImage } from "@/lib/media/public-image";
import { mediaUrl } from "@/lib/media/urls";
import { pickFallback, type ImageFormat } from "@/lib/media/variants";

const SOURCE_TYPES: [ImageFormat, string][] = [
  ["avif", "image/avif"],
  ["webp", "image/webp"],
  ["png", "image/png"],
];

/**
 * Responsive image from pre-generated variants: AVIF → WebP → PNG sources, lazy by default,
 * intrinsic size set to avoid layout shift, blurred placeholder behind it while loading.
 */
export function Picture({
  image,
  sizes = "100vw",
  alt,
  priority = false,
  className,
  imgClassName,
}: {
  image: PublicImage;
  sizes?: string;
  alt?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const variants = image.variants.filter((v) => v.name !== "og");
  const srcSet = (format: ImageFormat) =>
    variants
      .filter((v) => v.format === format)
      .sort((a, b) => a.width - b.width)
      .map((v) => `${mediaUrl(image.storageKey, v.file)} ${v.width}w`)
      .join(", ");
  const fallback = pickFallback(variants);

  return (
    <picture className={className}>
      {SOURCE_TYPES.map(([format, type]) => {
        const set = srcSet(format);
        return set ? <source key={format} type={type} srcSet={set} sizes={sizes} /> : null;
      })}
      <img
        src={mediaUrl(image.storageKey, fallback.file)}
        alt={alt ?? image.alt}
        width={image.width}
        height={image.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={imgClassName}
        style={
          image.blurDataUrl
            ? { backgroundImage: `url(${image.blurDataUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      />
    </picture>
  );
}
