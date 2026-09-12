import type { PageKey } from "@/generated/prisma/enums";

export const PAGE_KEYS: readonly PageKey[] = ["HOME", "ABOUT", "EVENTS", "TEAM", "GALLERY", "ANNOUNCEMENTS", "SPONSORS", "CONTACT"];

export const PAGE_ROUTES: Record<PageKey, string> = {
  HOME: "/",
  ABOUT: "/about",
  EVENTS: "/events",
  TEAM: "/team",
  GALLERY: "/gallery",
  ANNOUNCEMENTS: "/announcements",
  SPONSORS: "/sponsors",
  CONTACT: "/contact",
};

/** Pages whose public routes exist in the codebase. Grows as each phase ships a page. */
export const IMPLEMENTED_PAGES: ReadonlySet<PageKey> = new Set<PageKey>(["HOME", "EVENTS", "SPONSORS", "ABOUT", "CONTACT"]);

export type PageSettingDTO = {
  key: PageKey;
  enabled: boolean;
  showInNav: boolean;
  navLabel: string;
  navOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  content: unknown;
};

export type NavItem = { key: PageKey; label: string; href: string };

export function isPageLive(page: Pick<PageSettingDTO, "key" | "enabled"> | undefined, implemented = IMPLEMENTED_PAGES): boolean {
  if (!page || !implemented.has(page.key)) return false;
  return page.key === "HOME" || page.enabled;
}

export function buildNavigation(pages: readonly PageSettingDTO[], implemented = IMPLEMENTED_PAGES): NavItem[] {
  return pages
    .filter((p) => p.showInNav && isPageLive(p, implemented))
    .sort((a, b) => a.navOrder - b.navOrder || a.key.localeCompare(b.key))
    .map((p) => ({ key: p.key, label: p.navLabel, href: PAGE_ROUTES[p.key] }));
}
