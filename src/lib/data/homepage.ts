import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { homepageSectionsSchema, type HomepageSections } from "@/lib/homepage/sections/schema";
import { publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";

function parseSections(raw: unknown): HomepageSections {
  const parsed = homepageSectionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** The single editable draft row. Created on first use — there is no seed for it. */
export async function loadDraftHomepage(): Promise<{ id: string; sections: HomepageSections }> {
  const existing = await db.homepageRevision.findFirst({ where: { status: "DRAFT" } });
  if (existing) return { id: existing.id, sections: parseSections(existing.sections) };
  const created = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [] } });
  return { id: created.id, sections: [] };
}

/** Read-only variant for callers that must never create the draft row (e.g. preview). */
export async function loadDraftHomepageSections(): Promise<HomepageSections> {
  const existing = await db.homepageRevision.findFirst({ where: { status: "DRAFT" } });
  return existing ? parseSections(existing.sections) : [];
}

async function loadPublishedHomepage(): Promise<HomepageSections> {
  const row = await db.homepageRevision.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } });
  return row ? parseSections(row.sections) : [];
}

/** Cached for the public homepage; invalidated by `publishHomepageAction`. */
export const getPublishedHomepage = unstable_cache(loadPublishedHomepage, ["published-homepage"], { tags: [TAGS.homepage] });

export type HomepageHistoryEntry = { id: string; status: "PUBLISHED" | "SUPERSEDED"; publishedAt: string | null; publishedByName: string | null };

export async function loadHomepageHistory(): Promise<HomepageHistoryEntry[]> {
  const rows = await db.homepageRevision.findMany({
    where: { status: { in: ["PUBLISHED", "SUPERSEDED"] } },
    include: { publishedBy: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status as "PUBLISHED" | "SUPERSEDED",
    publishedAt: r.publishedAt?.toISOString() ?? null,
    publishedByName: r.publishedBy?.name ?? null,
  }));
}

export async function resolveHomepageImages(sections: HomepageSections): Promise<Record<string, PublicImage>> {
  const ids = new Set<string>();
  for (const s of sections) {
    if (s.type === "about" && s.content.imageId) ids.add(s.content.imageId);
    if (s.type === "achievements") for (const item of s.content.items) if (item.imageId) ids.add(item.imageId);
  }
  if (ids.size === 0) return {};
  const uploads = await db.upload.findMany({ where: { id: { in: [...ids] } }, select: publicImageSelect });
  const images: Record<string, PublicImage> = {};
  for (const u of uploads) {
    const img = toPublicImage(u);
    if (img) images[u.id] = img;
  }
  return images;
}
