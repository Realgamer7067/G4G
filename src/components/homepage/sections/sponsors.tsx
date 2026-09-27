// src/components/homepage/sections/sponsors.tsx
import { Picture } from "@/components/media/picture";
import { Reveal } from "@/components/motion/reveal";
import { getPublicSponsors } from "@/lib/data/sponsors";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function SponsorsSection({ section }: { section: SectionOfType<"sponsors"> }) {
  const all = await getPublicSponsors();
  const sponsors = section.content.tierFilter.length ? all.filter((s) => section.content.tierFilter.includes(s.tier)) : all;
  if (sponsors.length === 0) return null;
  return (
    <section id={section.anchorId} className="container-x py-20">
      <Reveal>
        <h2 className="mb-8 text-sm font-semibold text-muted">{section.headingOverride || "Supported by"}</h2>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-px overflow-hidden rounded-[20px] border border-line bg-line">
          {sponsors.map((s) => (
            <li key={s.id} className="group grid h-28 place-items-center bg-night px-6 transition-colors duration-200 hover:bg-surface">
              {s.logo ? (
                <Picture
                  image={s.logo}
                  sizes="160px"
                  alt={s.name}
                  imgClassName="max-h-10 w-auto object-contain opacity-70 grayscale transition-[filter,opacity] duration-300 group-hover:opacity-100 group-hover:grayscale-0"
                />
              ) : (
                <span className="text-center font-display font-bold text-muted transition-colors duration-200 group-hover:text-frost">{s.name}</span>
              )}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
