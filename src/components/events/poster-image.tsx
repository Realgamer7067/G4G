import { Picture } from "@/components/media/picture";
import type { PublicImage } from "@/lib/media/public-image";
import { cn } from "@/lib/utils/cn";

/**
 * An event poster shown whole, whatever its shape: square and A4 posters sit contained in the frame
 * over a blurred, darkened copy of themselves instead of being cropped to fit.
 */
export function PosterImage({ image, sizes, priority = false, className, imgClassName }: { image: PublicImage; sizes: string; priority?: boolean; className?: string; imgClassName?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-night", className)}>
      <Picture image={image} sizes="200px" alt="" placeholder={false} className="absolute inset-0 block" imgClassName="size-full scale-125 object-cover opacity-60 blur-2xl" />
      <div aria-hidden="true" className="absolute inset-0 bg-night/35" />
      <Picture image={image} sizes={sizes} alt="" priority={priority} placeholder={false} className="relative block size-full" imgClassName={cn("size-full object-contain", imgClassName)} />
    </div>
  );
}
