import { SocialIcon } from "@/components/site/social-icons";
import { MemberPortrait } from "@/components/site/team/member-portrait";
import type { PublicTeamMember } from "@/lib/data/team";
import { groupByDomain, groupByTier, teamMemberLinkList } from "@/lib/team/schema";

function MemberCard({ member, priority = false }: { member: PublicTeamMember; priority?: boolean }) {
  const links = teamMemberLinkList(member.links);
  return (
    <li className="reveal group grid min-w-0 content-start gap-4">
      <div className="relative">
        <MemberPortrait member={member} priority={priority} sizes="(min-width: 1280px) 290px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw" />
        {links.length > 0 && (
          <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5 transition-[opacity,transform] duration-200 [@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100">
            {links.map((l) => (
              <a
                key={l.key}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${member.name} on ${l.label}`}
                className="grid size-9 place-items-center rounded-full border border-white/10 bg-night/75 text-frost backdrop-blur transition-colors duration-150 hover:bg-leaf hover:text-night"
              >
                <SocialIcon network={l.network} className="size-3.5" />
              </a>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-0.5 break-words px-1">
        <p className="font-display text-lg font-bold leading-tight">{member.name}</p>
        <p className="text-sm text-muted">{member.title}</p>
        {member.bio && <p className="mt-2 break-words text-sm text-muted">{member.bio}</p>}
      </div>
    </li>
  );
}

/** Renders every non-empty tier in priority order; Domain Lead and Member tiers are subgrouped by domain. */
export function TeamGroups({ members }: { members: PublicTeamMember[] }) {
  const tierGroups = groupByTier(members);
  if (tierGroups.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">No members recorded for this term.</p>
    );
  }
  return (
    <div className="grid gap-20">
      {tierGroups.map((g, gi) => (
        <section key={g.tier} aria-labelledby={`tier-${g.tier}`} className="grid gap-6">
          <h2 id={`tier-${g.tier}`} className="border-b border-line pb-4 font-display text-3xl font-extrabold tracking-[-0.02em]">
            {g.label}
          </h2>
          {g.tier === "DOMAIN_LEAD" || g.tier === "MEMBER" ? (
            <div className="grid gap-10">
              {groupByDomain(g.members).map((dg) => (
                <div key={dg.domain?.id ?? "other"} className="grid gap-4">
                  <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{dg.domain?.name ?? "Other"}</h3>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
                    {dg.members.map((m) => (
                      <MemberCard key={m.id} member={m} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
              {g.members.map((m, i) => (
                // The first portraits of the first tier are above the fold on phones and desktops.
                <MemberCard key={m.id} member={m} priority={gi === 0 && i < 2} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
