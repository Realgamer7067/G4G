// src/components/homepage/sections/cta.tsx
import Link from "next/link";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { cn } from "@/lib/utils/cn";

const BG: Record<SectionOfType<"cta">["content"]["backgroundVariant"], string> = {
  solid: "bg-surface border border-line",
  gradient: "border border-leaf/25 bg-[radial-gradient(circle_at_85%_15%,rgb(92_201_123/0.18),transparent_50%)]",
  outline: "border border-line",
};

export function CtaSection({ section }: { section: SectionOfType<"cta"> }) {
  const c = section.content;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className={cn("grid gap-4 rounded-3xl p-8 text-center sm:p-10", BG[c.backgroundVariant])}>
        {c.eyebrow && <p className="font-mono text-xs uppercase tracking-[0.1em] text-leaf">{c.eyebrow}</p>}
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{section.headingOverride || c.heading}</h2>
        {(section.subheadingOverride || c.subheading) && <p className="mx-auto max-w-xl text-muted">{section.subheadingOverride || c.subheading}</p>}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {c.ctas.map((cta, i) => (
            <Link
              key={i}
              href={cta.href}
              className={cn("rounded-full px-5 py-3 font-semibold", cta.style === "primary" ? "bg-leaf text-night" : "border border-line text-frost hover:bg-raised")}
            >
              {cta.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
