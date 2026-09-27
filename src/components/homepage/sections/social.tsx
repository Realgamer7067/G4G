// src/components/homepage/sections/social.tsx
import { SocialIcon, socialLinks } from "@/components/site/social-icons";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { Socials } from "@/lib/settings/schema";

export function SocialSection({ section, socials }: { section: SectionOfType<"social">; socials: Socials }) {
  const links = socialLinks(socials);
  if (links.length === 0) return null;
  const c = section.content;
  return (
    <section id={section.anchorId} className="container-x flex flex-wrap items-center justify-between gap-6 border-t border-line/70 py-14">
      {section.headingOverride && <h2 className="font-display text-2xl font-bold tracking-tight">{section.headingOverride}</h2>}
      <div className="flex flex-wrap gap-3">
        {links.map((link) =>
          c.style === "buttons" ? (
            <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-leaf/40 hover:bg-raised">
              <SocialIcon network={link.network} className="size-4" /> {link.label}
            </a>
          ) : (
            <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label} className="grid size-11 place-items-center rounded-full border border-line text-muted transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-leaf/50 hover:text-leaf">
              <SocialIcon network={link.network} />
            </a>
          ),
        )}
      </div>
    </section>
  );
}
