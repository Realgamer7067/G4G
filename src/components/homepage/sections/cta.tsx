// src/components/homepage/sections/cta.tsx
import { ArrowRight } from "lucide-react";
import { Magnetic } from "@/components/motion/magnetic";
import { Reveal } from "@/components/motion/reveal";
import { Spotlight } from "@/components/site/spotlight";
import { LinkButton } from "@/components/ui/link-button";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { cn } from "@/lib/utils/cn";

const BG: Record<SectionOfType<"cta">["content"]["backgroundVariant"], string> = {
  solid: "bg-surface",
  gradient: "bg-[radial-gradient(circle_at_85%_10%,rgb(92_201_123/0.22),transparent_50%),radial-gradient(circle_at_0%_100%,rgb(47_141_70/0.25),transparent_55%)] bg-surface",
  outline: "bg-transparent",
};

export function CtaSection({ section }: { section: SectionOfType<"cta"> }) {
  const c = section.content;
  return (
    <section id={section.anchorId} className="container-x py-24">
      <Reveal>
        <Spotlight className="rounded-[32px]">
          <div className={cn("relative grid gap-8 overflow-hidden rounded-[32px] border border-line p-8 sm:p-14 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:p-16", BG[c.backgroundVariant])}>
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-[140%] w-40 rotate-[20deg] bg-leaf/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-24 h-[140%] w-10 rotate-[20deg] bg-leaf/15" />
            <div className="relative grid gap-4">
              {c.eyebrow && <p className="font-mono text-xs uppercase tracking-[0.14em] text-leaf">{c.eyebrow}</p>}
              <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-[1] tracking-[-0.035em] sm:text-6xl">{section.headingOverride || c.heading}</h2>
              {(section.subheadingOverride || c.subheading) && <p className="max-w-xl text-lg text-muted">{section.subheadingOverride || c.subheading}</p>}
            </div>
            <div className="relative flex flex-wrap gap-3 lg:justify-end">
              {c.ctas.map((cta, i) =>
                cta.style === "primary" ? (
                  <Magnetic key={i}>
                    <LinkButton href={cta.href} size="lg">
                      {cta.label}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </LinkButton>
                  </Magnetic>
                ) : (
                  <LinkButton key={i} href={cta.href} size="lg" variant="secondary">
                    {cta.label}
                  </LinkButton>
                ),
              )}
            </div>
          </div>
        </Spotlight>
      </Reveal>
    </section>
  );
}
