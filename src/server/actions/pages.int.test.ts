import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageKey } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { PAGE_KEYS } from "@/lib/pages/registry";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { savePagesAction } = await import("./pages");

function pagesForm(overrides: Partial<Record<PageKey, Record<string, string | undefined>>> = {}, order: PageKey[] = [...PAGE_KEYS]) {
  const fields: Record<string, string> = { order: JSON.stringify(order) };
  for (const key of PAGE_KEYS) {
    const row = { enabled: "on", showInNav: "on", navLabel: key.toLowerCase(), ...overrides[key] };
    for (const [field, value] of Object.entries(row)) if (value !== undefined) fields[`${key}.${field}`] = value;
  }
  return formOf(fields);
}

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("savePagesAction", () => {
  it("requires pages.manage", async () => {
    await signIn({ permissions: ["settings.manage"] });
    expect(await savePagesAction(undefined, pagesForm())).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("saves order, toggles and labels, and keeps the homepage on", async () => {
    await signIn({ permissions: ["pages.manage"] });
    const order: PageKey[] = ["HOME", "EVENTS", "ABOUT", "TEAM", "GALLERY", "ANNOUNCEMENTS", "SPONSORS", "CONTACT"];
    const result = await savePagesAction(
      undefined,
      pagesForm({ HOME: { enabled: undefined }, TEAM: { enabled: undefined, navLabel: "Our team" }, GALLERY: { showInNav: undefined } }, order),
    );
    expect(result).toEqual({ ok: true, data: null });

    const rows = Object.fromEntries((await db.pageSetting.findMany()).map((r) => [r.key, r]));
    expect(rows.HOME.enabled).toBe(true);
    expect(rows.TEAM).toMatchObject({ enabled: false, navLabel: "Our team", navOrder: 3 });
    expect(rows.GALLERY.showInNav).toBe(false);
    expect(rows.EVENTS.navOrder).toBe(1);
    expect(cache.revalidateTag).toHaveBeenCalledWith("page-settings", { expire: 0 });
    expect(await db.auditLog.count({ where: { action: "pages.updated" } })).toBe(1);
  });

  it("reports a missing menu label on the right page", async () => {
    await signIn({ permissions: ["pages.manage"] });
    const result = await savePagesAction(undefined, pagesForm({ ABOUT: { navLabel: "  " } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors?.["ABOUT.navLabel"]).toEqual(["Add a menu label."]);
  });

  it("rejects an incomplete page order", async () => {
    await signIn({ permissions: ["pages.manage"] });
    const result = await savePagesAction(undefined, pagesForm({}, ["HOME", "EVENTS"]));
    expect(result.ok).toBe(false);
  });
});
