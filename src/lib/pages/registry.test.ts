import { describe, expect, it } from "vitest";
import type { PageKey } from "@/generated/prisma/enums";
import { buildNavigation, isPageLive, type PageSettingDTO } from "./registry";

const page = (key: PageKey, overrides: Partial<PageSettingDTO> = {}): PageSettingDTO => ({
  key, enabled: true, showInNav: true, navLabel: key.toLowerCase(), navOrder: 0,
  seoTitle: null, seoDescription: null, content: {}, ...overrides,
});

const all = new Set<PageKey>(["HOME", "ABOUT", "EVENTS", "TEAM", "GALLERY", "ANNOUNCEMENTS", "SPONSORS", "CONTACT"]);

describe("buildNavigation", () => {
  it("lists enabled, visible, implemented pages in nav order", () => {
    const nav = buildNavigation(
      [page("TEAM", { navOrder: 3 }), page("EVENTS", { navOrder: 1, navLabel: "Events" }), page("ABOUT", { navOrder: 2 })],
      all,
    );
    expect(nav.map((n) => n.href)).toEqual(["/events", "/about", "/team"]);
    expect(nav[0]).toEqual({ key: "EVENTS", label: "Events", href: "/events" });
  });

  it("drops disabled pages, hidden pages and pages not built yet", () => {
    const implemented = new Set<PageKey>(["HOME", "EVENTS", "TEAM"]);
    const nav = buildNavigation(
      [page("EVENTS", { enabled: false }), page("TEAM", { showInNav: false }), page("GALLERY"), page("HOME", { showInNav: true })],
      implemented,
    );
    expect(nav.map((n) => n.key)).toEqual(["HOME"]);
  });
});

describe("isPageLive", () => {
  it("keeps the homepage live even if disabled", () => {
    expect(isPageLive(page("HOME", { enabled: false }), all)).toBe(true);
  });
  it("hides disabled or unbuilt pages", () => {
    expect(isPageLive(page("TEAM", { enabled: false }), all)).toBe(false);
    expect(isPageLive(page("TEAM"), new Set<PageKey>(["HOME"]))).toBe(false);
    expect(isPageLive(undefined, all)).toBe(false);
  });
});
