import "server-only";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import type { PageKey } from "@/generated/prisma/enums";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { buildNavigation, isPageLive, type NavItem, type PageSettingDTO } from "@/lib/pages/registry";

export async function loadPageSettings(): Promise<PageSettingDTO[]> {
  const rows = await db.pageSetting.findMany({ orderBy: [{ navOrder: "asc" }, { key: "asc" }] });
  return rows.map((r) => ({
    key: r.key,
    enabled: r.enabled,
    showInNav: r.showInNav,
    navLabel: r.navLabel,
    navOrder: r.navOrder,
    seoTitle: r.seoTitle,
    seoDescription: r.seoDescription,
    content: r.content,
  }));
}

/** Cached for public pages; invalidated with TAGS.pages. */
export const getPageSettings = unstable_cache(loadPageSettings, ["page-settings"], { tags: [TAGS.pages] });

export async function getPageSetting(key: PageKey): Promise<PageSettingDTO | undefined> {
  return (await getPageSettings()).find((p) => p.key === key);
}

export async function getNavigation(): Promise<NavItem[]> {
  return buildNavigation(await getPageSettings());
}

/** First line of every public page: 404 when the page is switched off (or not built yet). */
export async function assertPageEnabled(key: PageKey): Promise<PageSettingDTO> {
  const page = await getPageSetting(key);
  if (!page || !isPageLive(page)) notFound();
  return page;
}
