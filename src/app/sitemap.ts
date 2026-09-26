import type { MetadataRoute } from "next";
import type { PageKey } from "@/generated/prisma/enums";
import { getVisibleAnnouncements } from "@/lib/data/announcements";
import { getPublicEvents } from "@/lib/data/events";
import { getPageSettings } from "@/lib/data/pages";
import { getTeamArchive } from "@/lib/data/team";
import { PAGE_ROUTES, isPageLive } from "@/lib/pages/registry";

export const dynamic = "force-dynamic";

/** Live pages only; switched-off pages (and their children) drop out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const pages = await getPageSettings();
  const live = (key: PageKey) => isPageLive(pages.find((p) => p.key === key));

  const entries: MetadataRoute.Sitemap = pages
    .filter((p) => isPageLive(p))
    .map((p) => ({ url: `${base}${PAGE_ROUTES[p.key]}`, changeFrequency: "weekly", priority: p.key === "HOME" ? 1 : 0.7 }));

  if (live("EVENTS")) {
    for (const e of await getPublicEvents()) {
      entries.push({ url: `${base}/events/${e.slug}`, lastModified: e.startAt, changeFrequency: "weekly", priority: 0.6 });
    }
  }
  if (live("ANNOUNCEMENTS")) {
    for (const a of await getVisibleAnnouncements()) {
      entries.push({ url: `${base}/announcements/${a.slug}`, lastModified: new Date(a.updatedAt), changeFrequency: "weekly", priority: 0.5 });
    }
  }
  if (live("TEAM")) {
    for (const t of await getTeamArchive()) {
      entries.push({ url: `${base}/team/${t.startYear}`, changeFrequency: "yearly", priority: 0.4 });
    }
  }
  return entries;
}
