// src/components/homepage/sections/achievements.tsx
import { Picture } from "@/components/media/picture";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";

export function AchievementsSection({ section, images }: { section: SectionOfType<"achievements">; images: Record<string, PublicImage> }) {
  const c = section.content;
  if (c.items.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Always an h2 (visually hidden without an override) so the item h3s never skip a level. */}
      <h2 className={section.headingOverride ? "mb-8 text-center font-display text-3xl font-bold" : "sr-only"}>{section.headingOverride || "Achievements"}</h2>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {c.items
          .slice()
          .sort((a, b) => b.year - a.year)
          .map((item) => (
            <li key={item.id} className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
              {item.imageId && images[item.imageId] && (
                <Picture image={images[item.imageId]} sizes="360px" alt="" className="overflow-hidden rounded-xl" imgClassName="aspect-video w-full object-cover" />
              )}
              <p className="font-mono text-xs uppercase tracking-[0.1em] text-leaf">{item.year}</p>
              <h3 className="font-semibold">{item.title}</h3>
              {item.description && <p className="text-sm text-muted">{item.description}</p>}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm text-leaf hover:underline">
                  Learn more<span className="sr-only"> about {item.title}</span>
                </a>
              )}
            </li>
          ))}
      </ul>
    </section>
  );
}
