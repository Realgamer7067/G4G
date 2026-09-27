// src/components/homepage/sections/gallery-highlights.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { getGalleryHighlights } from "@/lib/data/gallery";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { cn } from "@/lib/utils/cn";

// Bento layouts by tile count: the first tile always dominates, the rest fill the grid without holes.
const LAYOUTS: Record<number, string[]> = {
  1: ["col-span-2 row-span-2 sm:col-span-4"],
  2: ["col-span-2 row-span-2", "col-span-2 row-span-2"],
  3: ["col-span-2 row-span-2", "sm:col-span-2", "sm:col-span-2"],
  4: ["col-span-2 row-span-2", "", "", "col-span-2"],
  5: ["col-span-2 row-span-2", "", "", "col-span-2 sm:col-span-1", "hidden sm:block"],
};

export async function GalleryHighlightsSection({ section }: { section: SectionOfType<"gallery_highlights"> }) {
  const c = section.content;
  const rows = (await getGalleryHighlights(c.mode, c.albumId, c.maxItems)).slice(0, 5);
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="container-x py-24">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="max-w-xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">{section.headingOverride || "Moments from the chapter"}</h2>
        <Link href="/gallery" className="group inline-flex items-center gap-2 text-sm font-semibold text-leaf">
          <span className="link-sweep">View albums</span>
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </Reveal>
      <Stagger className="grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:grid-cols-4 lg:auto-rows-[13rem]">
        {rows.map((g, i) => (
          <StaggerItem key={g.id} className={cn("min-h-0", LAYOUTS[rows.length][i])}>
            <Link href={`/gallery/${g.albumSlug}`} className="group relative block size-full overflow-hidden rounded-[20px] bg-raised">
              <Picture
                image={g.image}
                sizes={i === 0 ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 640px) 25vw, 50vw"}
                alt={g.caption || `Photo from ${g.albumTitle}`}
                imgClassName="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
              />
              <span className="absolute inset-x-0 bottom-0 flex items-end bg-[linear-gradient(to_top,rgb(8_18_13/0.85),transparent)] p-4 pt-10 text-sm font-semibold text-frost transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:opacity-100">
                {g.albumTitle}
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
