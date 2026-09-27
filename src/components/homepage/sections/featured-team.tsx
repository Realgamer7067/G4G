// src/components/homepage/sections/featured-team.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { SocialIcon } from "@/components/site/social-icons";
import { Spotlight } from "@/components/site/spotlight";
import { MemberPortrait } from "@/components/site/team/member-portrait";
import { getCurrentTeam } from "@/lib/data/team";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { teamMemberLinkList } from "@/lib/team/schema";

export async function FeaturedTeamSection({ section }: { section: SectionOfType<"featured_team"> }) {
  const team = await getCurrentTeam();
  const rows = (team?.members ?? []).filter((m) => m.featured).slice(0, section.content.maxItems);
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="container-x py-24">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-3">
          <h2 className="max-w-xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">{section.headingOverride || "The people behind it"}</h2>
          {team && <p className="text-muted">Core team, {team.term.label}</p>}
        </div>
        <Link href="/team" className="group inline-flex items-center gap-2 text-sm font-semibold text-leaf">
          <span className="link-sweep">Meet the full team</span>
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </Reveal>
      <Stagger className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {rows.map((m) => {
          const links = teamMemberLinkList(m.links).slice(0, 3);
          return (
            <StaggerItem key={m.id}>
              <Spotlight className="rounded-[24px]">
                <div className="group grid gap-4 rounded-[24px] border border-line bg-surface p-3 pb-5">
                  <MemberPortrait member={m} sizes="(min-width: 1024px) 300px, 45vw" />
                  <div className="grid gap-0.5 px-2">
                    <p className="font-display text-lg font-bold leading-tight">{m.name}</p>
                    <p className="text-sm text-muted">{m.title}</p>
                  </div>
                  {links.length > 0 && (
                    <div className="flex gap-1.5 px-2">
                      {links.map((l) => (
                        <a
                          key={l.key}
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${m.name} on ${l.label}`}
                          className="grid size-9 place-items-center rounded-full border border-line text-muted transition-colors duration-150 hover:border-leaf/50 hover:text-leaf"
                        >
                          <SocialIcon network={l.network} className="size-3.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </Spotlight>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
