import { Picture } from "@/components/media/picture";
import { SocialIcon } from "@/components/site/social-icons";
import type { PublicTeamMember } from "@/lib/data/team";
import { groupByDomain, groupByTier, teamMemberLinkList } from "@/lib/team/schema";

function MemberCard({ member }: { member: PublicTeamMember }) {
  const links = teamMemberLinkList(member.links);
  return (
    <li className="grid min-w-0 gap-3 rounded-2xl border border-line bg-surface p-5 text-center">
      <div className="mx-auto size-24 overflow-hidden rounded-full bg-tile">
        {member.photo && <Picture image={member.photo} sizes="96px" alt="" imgClassName="size-full object-cover" />}
      </div>
      <div className="grid gap-0.5 break-words">
        <p className="font-semibold">{member.name}</p>
        <p className="text-sm text-muted">{member.title}</p>
      </div>
      {member.bio && <p className="break-words text-sm text-muted">{member.bio}</p>}
      {links.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${member.name} on ${l.label}`}
              className="grid size-8 place-items-center rounded-full border border-line text-muted hover:text-leaf"
            >
              <SocialIcon network={l.network} className="size-3.5" />
            </a>
          ))}
        </div>
      )}
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
    <div className="grid gap-14">
      {tierGroups.map((g) => (
        <section key={g.tier} aria-labelledby={`tier-${g.tier}`} className="grid gap-6">
          <h2 id={`tier-${g.tier}`} className="font-display text-2xl font-bold">
            {g.label}
          </h2>
          {g.tier === "DOMAIN_LEAD" || g.tier === "MEMBER" ? (
            <div className="grid gap-10">
              {groupByDomain(g.members).map((dg) => (
                <div key={dg.domain?.id ?? "other"} className="grid gap-4">
                  <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{dg.domain?.name ?? "Other"}</h3>
                  <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {dg.members.map((m) => (
                      <MemberCard key={m.id} member={m} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.members.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
