import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { teamLinksSchema, type TeamMemberDTO, type TeamTier } from "@/lib/team/schema";

export type PublicTeamMember = TeamMemberDTO;
export type PublicTeam = { term: { id: string; label: string; startYear: number }; members: PublicTeamMember[] };

const MEMBER_INCLUDE = {
  photo: { select: publicImageSelect },
  domain: { select: { id: true, name: true, order: true } },
} as const;

type MemberRow = {
  id: string;
  name: string;
  title: string;
  tier: TeamTier;
  bio: string;
  featured: boolean;
  order: number;
  links: unknown;
  photo: Parameters<typeof toPublicImage>[0];
  domain: { id: string; name: string; order: number } | null;
};

function toPublicMember(m: MemberRow): PublicTeamMember {
  return {
    id: m.id,
    name: m.name,
    title: m.title,
    tier: m.tier,
    bio: m.bio,
    featured: m.featured,
    order: m.order,
    links: teamLinksSchema.parse(m.links),
    photo: toPublicImage(m.photo),
    domain: m.domain,
  };
}

async function loadTeamByTermId(termId: string, label: string, startYear: number): Promise<PublicTeam> {
  const members = await db.teamMember.findMany({
    where: { termId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: MEMBER_INCLUDE,
  });
  return { term: { id: termId, label, startYear }, members: members.map(toPublicMember) };
}

async function loadCurrentTeamRaw(): Promise<PublicTeam | null> {
  const term = await db.teamTerm.findFirst({ where: { isCurrent: true, isPublished: true } });
  if (!term) return null;
  return loadTeamByTermId(term.id, term.label, term.startYear);
}

/** Cached; invalidated with TAGS.team whenever a term or member changes. */
export const getCurrentTeam = unstable_cache(loadCurrentTeamRaw, ["current-team"], { tags: [TAGS.team] });

export type ArchiveTermDTO = { id: string; label: string; startYear: number };

async function loadTeamArchive(): Promise<ArchiveTermDTO[]> {
  const rows = await db.teamTerm.findMany({ where: { isPublished: true, isCurrent: false }, orderBy: { startYear: "desc" } });
  return rows.map((t) => ({ id: t.id, label: t.label, startYear: t.startYear }));
}

export const getTeamArchive = unstable_cache(loadTeamArchive, ["team-archive"], { tags: [TAGS.team] });

async function loadPublicTeamByYear(startYear: number): Promise<PublicTeam | null> {
  const term = await db.teamTerm.findUnique({ where: { startYear } });
  if (!term || !term.isPublished) return null;
  return loadTeamByTermId(term.id, term.label, term.startYear);
}

/** One cache entry per year; small dataset, so the shared TAGS.team tag is enough (no per-year tag). */
export function getPublicTeamByYear(startYear: number): Promise<PublicTeam | null> {
  return unstable_cache(() => loadPublicTeamByYear(startYear), ["team-year", String(startYear)], { tags: [TAGS.team] })();
}
