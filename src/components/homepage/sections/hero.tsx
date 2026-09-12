// src/components/homepage/sections/hero.tsx
import Link from "next/link";
import { LogoTile } from "@/components/brand/logo-tile";
import { Rings } from "@/components/site/rings";
import { SocialIcon, socialLinks } from "@/components/site/social-icons";
import type { Socials } from "@/lib/settings/schema";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { cn } from "@/lib/utils/cn";

export function HeroSection({ section, socials }: { section: SectionOfType<"hero">; socials: Socials }) {
  const c = section.content;
  return (
    <section id={section.anchorId} className="relative isolate overflow-hidden">
      {c.backgroundVariant === "rings" && <Rings className="pointer-events-none absolute -right-48 top-1/2 -z-10 size-[760px] -translate-y-1/2 opacity-50" />}
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-16 sm:px-6 md:grid-cols-[1.3fr_1fr] md:items-center md:pt-24 lg:px-8">
        <div className="grid gap-6">
          {c.eyebrow && <p className="font-mono text-xs uppercase tracking-[0.1em] text-leaf">{c.eyebrow}</p>}
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            {section.headingOverride || c.heading}
            {c.highlightedWord && <span className="text-leaf"> {c.highlightedWord}</span>}
          </h1>
          {(section.subheadingOverride || c.subheading) && <p className="max-w-xl text-lg text-muted">{section.subheadingOverride || c.subheading}</p>}
          {c.ctas.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {c.ctas.map((cta, i) => (
                <Link
                  key={i}
                  href={cta.href}
                  className={cn(
                    "rounded-full px-5 py-3 font-semibold",
                    cta.style === "primary" ? "bg-leaf text-night" : "border border-line text-frost hover:bg-raised",
                  )}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          )}
          {c.showSocials && (
            <div className="flex gap-3 pt-2">
              {socialLinks(socials).map((link) => (
                <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-full border border-line text-muted hover:text-leaf">
                  <SocialIcon network={link.network} />
                </a>
              ))}
            </div>
          )}
        </div>
        {c.showLogoTile && (
          <div className="justify-self-center">
            <LogoTile size="lg" priority />
          </div>
        )}
      </div>
    </section>
  );
}
