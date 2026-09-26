// src/components/homepage/sections/gallery-highlights.tsx
import { Picture } from "@/components/media/picture";
import { getGalleryHighlights } from "@/lib/data/gallery";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function GalleryHighlightsSection({ section }: { section: SectionOfType<"gallery_highlights"> }) {
  const c = section.content;
  const rows = await getGalleryHighlights(c.mode, c.albumId, c.maxItems);
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((g) => (
          <li key={g.id} className="aspect-square overflow-hidden rounded-xl bg-tile">
            <Picture image={g.image} sizes="240px" alt="" imgClassName="size-full object-cover" />
          </li>
        ))}
      </ul>
    </section>
  );
}
