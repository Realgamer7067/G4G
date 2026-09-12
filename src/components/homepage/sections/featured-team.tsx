// src/components/homepage/sections/featured-team.tsx
import { Picture } from "@/components/media/picture";
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";

export async function FeaturedTeamSection({ section }: { section: SectionOfType<"featured_team"> }) {
  const rows = await db.teamMember.findMany({
    where: { featured: true, term: { isCurrent: true } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    take: section.content.maxItems,
    include: { photo: { select: publicImageSelect } },
  });
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((m) => {
          const photo = toPublicImage(m.photo);
          return (
            <li key={m.id} className="grid gap-2 text-center">
              <div className="mx-auto size-24 overflow-hidden rounded-full bg-tile">
                {photo && <Picture image={photo} sizes="96px" alt="" imgClassName="size-full object-cover" />}
              </div>
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-muted">{m.title}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
