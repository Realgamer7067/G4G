// src/lib/team/schema.ts
import { z } from "zod";
import { isChecked } from "@/lib/forms-data";
import type { PublicImage } from "@/lib/media/public-image";
import { isHttpUrl } from "@/lib/settings/schema";

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || isHttpUrl(v), "Use a full link that starts with https://.")
  .default("");

export const TEAM_TIERS = ["FACULTY", "LEAD", "CORE", "DOMAIN_LEAD", "MEMBER"] as const;
export type TeamTier = (typeof TEAM_TIERS)[number];

export const TEAM_TIER_LABELS: Record<TeamTier, string> = {
  FACULTY: "Faculty",
  LEAD: "Chapter lead",
  CORE: "Core team",
  DOMAIN_LEAD: "Domain lead",
  MEMBER: "Member",
};

export const teamLinksSchema = z.object({
  linkedin: optionalUrl,
  github: optionalUrl,
  instagram: optionalUrl,
  website: optionalUrl,
  x: optionalUrl,
});
export type TeamLinks = z.infer<typeof teamLinksSchema>;

const idField = z
  .string()
  .nullish()
  .transform((v) => v || null);

export const teamTermSchema = z.object({
  id: idField,
  label: text(40).min(1, "Give the term a label, e.g. 2026-27."),
  startYear: z.preprocess(
    (v) => (v === "" || v == null ? NaN : Number(v)),
    z.number().int().min(2000, "Enter a year from 2000 to 2100.").max(2100, "Enter a year from 2000 to 2100."),
  ),
});

export const teamDomainSchema = z.object({
  id: idField,
  name: text(40).min(2, "Name the domain."),
});

export const teamMemberSchema = z.object({
  id: idField,
  termId: z.string().min(1),
  name: text(80).min(1, "Enter the member's name."),
  photoId: idField,
  title: text(60).min(1, "Give them a title, e.g. Chapter Lead."),
  tier: z.enum(TEAM_TIERS).default("MEMBER"),
  domainId: idField,
  bio: z.string().trim().max(600, "Keep the bio under 600 characters.").default(""),
  links: teamLinksSchema.default(() => ({ linkedin: "", github: "", instagram: "", website: "", x: "" })),
  featured: z.unknown().optional().transform(isChecked),
  order: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(9999)),
});

export type TeamMemberDTO = {
  id: string;
  name: string;
  title: string;
  tier: TeamTier;
  bio: string;
  featured: boolean;
  order: number;
  links: TeamLinks;
  photo: PublicImage | null;
  domain: { id: string; name: string; order: number } | null;
};

function byOrder(a: TeamMemberDTO, b: TeamMemberDTO): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

/** One group per non-empty tier, in tier-priority order. */
export function groupByTier(members: readonly TeamMemberDTO[]): { tier: TeamTier; label: string; members: TeamMemberDTO[] }[] {
  return TEAM_TIERS.map((tier) => ({
    tier,
    label: TEAM_TIER_LABELS[tier],
    members: members.filter((m) => m.tier === tier).sort(byOrder),
  })).filter((g) => g.members.length > 0);
}

/** Groups by domain order, with domainless members in a trailing "Other" group. */
export function groupByDomain(members: readonly TeamMemberDTO[]): { domain: { id: string; name: string } | null; members: TeamMemberDTO[] }[] {
  const withDomain = [...members.filter((m) => m.domain)].sort((a, b) => a.domain!.order - b.domain!.order || byOrder(a, b));
  const withoutDomain = [...members.filter((m) => !m.domain)].sort(byOrder);

  const groups: { domain: { id: string; name: string } | null; members: TeamMemberDTO[] }[] = [];
  for (const m of withDomain) {
    const last = groups.at(-1);
    if (last && last.domain?.id === m.domain!.id) last.members.push(m);
    else groups.push({ domain: { id: m.domain!.id, name: m.domain!.name }, members: [m] });
  }
  if (withoutDomain.length > 0) groups.push({ domain: null, members: withoutDomain });
  return groups;
}

/** Moves the id at `direction` (-1 up, +1 down); returns null when there's nowhere to move. */
export function reorderIds(ids: readonly string[], id: string, direction: -1 | 1): string[] | null {
  const index = ids.indexOf(id);
  const to = index + direction;
  if (index === -1 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export type TeamLinkItem = { key: string; network: "linkedin" | "github" | "instagram" | "x" | "custom"; label: string; url: string };

/** Non-empty links in a fixed display order; `website` renders through SocialIcon's "custom" branch. */
export function teamMemberLinkList(links: TeamLinks): TeamLinkItem[] {
  const out: TeamLinkItem[] = [];
  if (links.linkedin) out.push({ key: "linkedin", network: "linkedin", label: "LinkedIn", url: links.linkedin });
  if (links.github) out.push({ key: "github", network: "github", label: "GitHub", url: links.github });
  if (links.instagram) out.push({ key: "instagram", network: "instagram", label: "Instagram", url: links.instagram });
  if (links.x) out.push({ key: "x", network: "x", label: "X", url: links.x });
  if (links.website) out.push({ key: "website", network: "custom", label: "Website", url: links.website });
  return out;
}
