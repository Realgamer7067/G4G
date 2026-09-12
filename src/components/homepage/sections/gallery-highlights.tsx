// src/components/homepage/sections/gallery-highlights.tsx
import { Picture } from "@/components/media/picture";
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";

export async function GalleryHighlightsSection({ section }: { section: SectionOfType<"gallery_highlights"> }) {
  const c = section.content;
  const rows = await db.galleryImage.findMany({
    where: c.mode === "album" && c.albumId ? { albumId: c.albumId, album: { isPublished: true } } : { album: { isPublished: true } },
    orderBy: { createdAt: "desc" },
    take: c.maxItems,
    include: { upload: { select: publicImageSelect } },
  });
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((g) => {
          const image = toPublicImage(g.upload);
          return (
            <li key={g.id} className="aspect-square overflow-hidden rounded-xl bg-tile">
              {image && <Picture image={image} sizes="240px" alt="" imgClassName="size-full object-cover" />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
