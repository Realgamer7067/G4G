// src/components/homepage/sections/about.tsx
import { Picture } from "@/components/media/picture";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";

export function AboutSection({ section, image }: { section: SectionOfType<"about">; image: PublicImage | null }) {
  const c = section.content;
  if (!c.body && !section.headingOverride) return null;
  return (
    <section id={section.anchorId} className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1fr] md:items-center lg:px-8">
      <div className="grid gap-3">
        {(section.headingOverride || c.heading) && <h2 className="font-display text-3xl font-bold">{section.headingOverride || c.heading}</h2>}
        {c.body.split("\n").filter(Boolean).map((para, i) => (
          <p key={i} className="text-muted">
            {para}
          </p>
        ))}
      </div>
      {image && <Picture image={image} sizes="(min-width: 768px) 480px, 100vw" alt="" className="overflow-hidden rounded-3xl" imgClassName="aspect-[4/3] w-full object-cover" />}
    </section>
  );
}
