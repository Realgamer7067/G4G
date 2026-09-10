import { cn } from "@/lib/utils/cn";

const SIZES = {
  sm: { box: "size-10 rounded-[10px] p-1", px: 32 },
  md: { box: "size-14 rounded-[14px] p-1.5", px: 44 },
  lg: {
    box: "size-40 rounded-[28px] p-4 shadow-[0_0_0_1px_rgb(189_243_203/0.45),0_24px_60px_-18px_rgb(92_201_123/0.35)]",
    px: 128,
  },
} as const;

/** The original logo, never recoloured, always on the light tile. */
export function LogoTile({
  size = "sm",
  priority = false,
  className,
}: {
  size?: keyof typeof SIZES;
  priority?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={cn("grid shrink-0 place-items-center bg-tile shadow-[0_0_0_1px_rgb(189_243_203/0.35)]", s.box, className)}>
      <picture>
        <source srcSet="/brand/logo.webp" type="image/webp" />
        <img
          src="/brand/logo.png"
          alt="GeeksforGeeks Student Chapter"
          width={s.px}
          height={s.px}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-contain"
        />
      </picture>
    </span>
  );
}
