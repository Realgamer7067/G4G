// src/components/homepage/sections/marquee.tsx
import { Marquee } from "@/components/motion/marquee";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export function MarqueeSection({ section }: { section: SectionOfType<"marquee"> }) {
  const items = section.content.items;
  if (items.length === 0) return null;
  return (
    <section id={section.anchorId} aria-label={section.headingOverride || "What we work on"} className="border-y border-line/70 bg-pine/60 py-7 sm:py-9">
      <Marquee items={items} duration={Math.max(24, items.length * 6)} />
    </section>
  );
}
