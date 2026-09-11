import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";

export type SponsorDTO = {
  id: string;
  name: string;
  website: string | null;
  description: string;
  tier: "TITLE" | "POWERED_BY" | "COMMUNITY_PARTNER" | "TECHNOLOGY_PARTNER" | "PARTNER";
  label: string | null;
  logo: PublicImage | null;
};

export async function loadPublicSponsors(): Promise<SponsorDTO[]> {
  const rows = await db.sponsor.findMany({
    where: { isActive: true, showOnSponsorsPage: true },
    include: { logo: { select: publicImageSelect } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    website: s.website,
    description: s.description,
    tier: s.tier,
    label: s.customLabel,
    logo: toPublicImage(s.logo),
  }));
}

export const getPublicSponsors = unstable_cache(loadPublicSponsors, ["public-sponsors"], { tags: [TAGS.sponsors] });
