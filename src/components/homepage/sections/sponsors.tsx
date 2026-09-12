// src/components/homepage/sections/sponsors.tsx
import { Picture } from "@/components/media/picture";
import { getPublicSponsors } from "@/lib/data/sponsors";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function SponsorsSection({ section }: { section: SectionOfType<"sponsors"> }) {
  const all = await getPublicSponsors();
  const sponsors = section.content.tierFilter.length ? all.filter((s) => section.content.tierFilter.includes(s.tier)) : all;
  if (sponsors.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="flex flex-wrap items-center justify-center gap-8">
        {sponsors.map((s) => (
          <li key={s.id} className="grid h-16 place-items-center rounded-xl bg-tile px-6">
            {s.logo ? <Picture image={s.logo} sizes="160px" alt={s.name} imgClassName="max-h-10 w-auto object-contain" /> : <span className="font-semibold">{s.name}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
