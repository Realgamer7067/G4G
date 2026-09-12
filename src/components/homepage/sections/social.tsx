// src/components/homepage/sections/social.tsx
import { SocialIcon, socialLinks } from "@/components/site/social-icons";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { Socials } from "@/lib/settings/schema";

export function SocialSection({ section, socials }: { section: SectionOfType<"social">; socials: Socials }) {
  const links = socialLinks(socials);
  if (links.length === 0) return null;
  const c = section.content;
  return (
    <section id={section.anchorId} className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-6 font-display text-2xl font-bold">{section.headingOverride}</h2>}
      <div className="flex flex-wrap justify-center gap-3">
        {links.map((link) =>
          c.style === "buttons" ? (
            <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:bg-raised">
              <SocialIcon network={link.network} className="size-4" /> {link.label}
            </a>
          ) : (
            <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label} className="grid size-10 place-items-center rounded-full border border-line text-muted hover:text-leaf">
              <SocialIcon network={link.network} />
            </a>
          ),
        )}
      </div>
    </section>
  );
}
