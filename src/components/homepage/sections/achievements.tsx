// src/components/homepage/sections/achievements.tsx
import { ArrowUpRight } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { Reveal } from "@/components/motion/reveal";
import { ScrollLine } from "@/components/motion/scroll-line";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";

export function AchievementsSection({ section, images }: { section: SectionOfType<"achievements">; images: Record<string, PublicImage> }) {
  const c = section.content;
  if (c.items.length === 0) return null;
  const items = c.items.slice().sort((a, b) => b.year - a.year);
  return (
    <section id={section.anchorId} className="container-x grid gap-12 py-24 lg:grid-cols-[0.8fr_2fr] lg:gap-16">
      {/* Always an h2 (visually hidden without an override) so the item h3s never skip a level. */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <h2 className={section.headingOverride ? "font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em]" : "sr-only"}>{section.headingOverride || "Achievements"}</h2>
      </div>
      <ScrollLine>
        <ol className="grid gap-12">
          {items.map((item) => (
            <li key={item.id} className="relative pl-10">
              <span aria-hidden="true" className="absolute left-0 top-1.5 size-[15px] rounded-full border-2 border-leaf bg-night" />
              <Reveal className="grid gap-3 sm:grid-cols-[1fr_auto] sm:gap-8">
                <div className="grid content-start gap-2">
                  <p className="font-mono text-sm font-semibold tracking-[0.06em] text-leaf">{item.year}</p>
                  <h3 className="font-display text-2xl font-bold tracking-tight">{item.title}</h3>
                  {item.description && <p className="max-w-[60ch] text-muted">{item.description}</p>}
                  {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="group inline-flex w-fit items-center gap-1 text-sm font-semibold text-leaf">
                      <span className="link-sweep">
                        Learn more<span className="sr-only"> about {item.title}</span>
                      </span>
                      <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
                {item.imageId && images[item.imageId] && (
                  <Picture image={images[item.imageId]} sizes="240px" alt="" className="overflow-hidden rounded-[20px] sm:w-60" imgClassName="aspect-[4/3] w-full object-cover" />
                )}
              </Reveal>
            </li>
          ))}
        </ol>
      </ScrollLine>
    </section>
  );
}
