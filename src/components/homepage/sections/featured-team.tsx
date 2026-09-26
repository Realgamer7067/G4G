// src/components/homepage/sections/featured-team.tsx
import { Picture } from "@/components/media/picture";
import { getCurrentTeam } from "@/lib/data/team";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function FeaturedTeamSection({ section }: { section: SectionOfType<"featured_team"> }) {
  const team = await getCurrentTeam();
  const rows = (team?.members ?? []).filter((m) => m.featured).slice(0, section.content.maxItems);
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((m) => (
          <li key={m.id} className="grid gap-2 text-center">
            <div className="mx-auto size-24 overflow-hidden rounded-full bg-tile">
              {m.photo && <Picture image={m.photo} sizes="96px" alt="" imgClassName="size-full object-cover" />}
            </div>
            <p className="font-medium">{m.name}</p>
            <p className="text-xs text-muted">{m.title}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
