import type { MetadataRoute } from "next";
import { getPageSettings } from "@/lib/data/pages";
import { PAGE_ROUTES, isPageLive } from "@/lib/pages/registry";

export const dynamic = "force-dynamic";

/** Live pages only; switched-off pages drop out. Later phases add events, albums and announcements. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const pages = await getPageSettings();
  return pages
    .filter((p) => isPageLive(p))
    .map((p) => ({ url: `${base}${PAGE_ROUTES[p.key]}`, changeFrequency: "weekly" as const, priority: p.key === "HOME" ? 1 : 0.7 }));
}
