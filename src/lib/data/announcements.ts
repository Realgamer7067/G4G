// src/lib/data/announcements.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { isAnnouncementVisible, selectBannerAnnouncement } from "@/lib/announcements/visibility";
import { TAGS } from "@/lib/cache-tags";
import { getPageSetting } from "@/lib/data/pages";
import { db } from "@/lib/db";
import { isPageLive } from "@/lib/pages/registry";

export type AnnouncementDTO = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  pinned: boolean;
  showOnHomepage: boolean;
  showAsBanner: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  publishAt: string;
  expiresAt: string | null;
  updatedAt: string;
};

async function loadPublishedAnnouncements(): Promise<AnnouncementDTO[]> {
  const rows = await db.announcement.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      priority: true,
      pinned: true,
      showOnHomepage: true,
      showAsBanner: true,
      linkUrl: true,
      linkLabel: true,
      publishAt: true,
      expiresAt: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    publishAt: r.publishAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Every PUBLISHED row. Tag-invalidated on writes, and re-fetched at least every 60s so publishAt/expiresAt windows stay accurate. */
export const getPublishedAnnouncements = unstable_cache(loadPublishedAnnouncements, ["published-announcements"], {
  tags: [TAGS.announcements],
  revalidate: 60,
});

/** PUBLISHED rows currently inside their publishAt/expiresAt window. */
export async function getVisibleAnnouncements(now: Date = new Date()): Promise<AnnouncementDTO[]> {
  const rows = await getPublishedAnnouncements();
  return rows.filter((a) => isAnnouncementVisible({ status: "PUBLISHED", publishAt: new Date(a.publishAt), expiresAt: a.expiresAt ? new Date(a.expiresAt) : null }, now));
}

export async function getPublicAnnouncement(slug: string): Promise<AnnouncementDTO | null> {
  const rows = await getVisibleAnnouncements();
  return rows.find((a) => a.slug === slug) ?? null;
}

export async function getHomepageAnnouncements(maxItems: number): Promise<AnnouncementDTO[]> {
  const rows = await getVisibleAnnouncements();
  return rows.filter((a) => a.showOnHomepage).slice(0, maxItems);
}

/** Highest-priority visible banner announcement, or null when Announcements is disabled or none qualify. */
export async function getBannerAnnouncement(now: Date = new Date()): Promise<AnnouncementDTO | null> {
  const page = await getPageSetting("ANNOUNCEMENTS");
  if (!page || !isPageLive(page)) return null;
  const rows = await getVisibleAnnouncements(now);
  const candidates = rows.map((a) => ({ ...a, status: "PUBLISHED" as const, publishAt: new Date(a.publishAt), expiresAt: a.expiresAt ? new Date(a.expiresAt) : null, updatedAt: new Date(a.updatedAt) }));
  const winner = selectBannerAnnouncement(candidates, now);
  return winner ? (rows.find((a) => a.id === winner.id) ?? null) : null;
}
