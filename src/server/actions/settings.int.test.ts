import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { updateSiteSettingsAction } = await import("./settings");

const valid = {
  clubName: "GeeksforGeeks Student Chapter",
  shortName: "GFG Chapter",
  tagline: "Build together",
  description: "We build things.",
  universityName: "Test University",
  email: "chapter@example.edu",
  phone: "",
  address: "",
  mapUrl: "",
  timezone: "Asia/Kolkata",
  logoId: "",
  "socials.github": "https://github.com/gfg-chapter",
  "socials.custom": "[]",
  "footer.blurb": "Built by students.",
  "footer.copyright": "GFG Chapter",
  "footer.columns": JSON.stringify([{ title: "Explore", links: [{ label: "Events", href: "/events" }] }]),
  "seo.titleTemplate": "%s · GFG",
  "seo.defaultDescription": "Workshops and hackathons.",
  "seo.ogImageId": "",
  "navCta.label": "Join us",
  "navCta.href": "/forms/join",
};

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("updateSiteSettingsAction", () => {
  it("requires settings.manage", async () => {
    await signIn({ permissions: ["dashboard.view"] });
    expect(await updateSiteSettingsAction(undefined, formOf(valid))).toEqual({ ok: false, error: "You don't have permission to do that." });
    expect(await db.siteSettings.count()).toBe(0);
  });

  it("saves settings, audits the change and refreshes the public cache", async () => {
    const { admin } = await signIn({ permissions: ["settings.manage"] });
    expect(await updateSiteSettingsAction(undefined, formOf(valid))).toEqual({ ok: true, data: null });

    const row = await db.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.clubName).toBe("GeeksforGeeks Student Chapter");
    expect(row.socials).toMatchObject({ github: "https://github.com/gfg-chapter", instagram: "" });
    expect(row.navCtas).toEqual([{ label: "Join us", href: "/forms/join" }]);
    expect(row.footer).toMatchObject({ columns: [{ title: "Explore", links: [{ label: "Events", href: "/events" }] }] });

    const log = await db.auditLog.findFirstOrThrow({ where: { action: "settings.updated", actorId: admin.id } });
    expect(log.metadata).toMatchObject({ changed: expect.arrayContaining(["clubName", "socials"]) });
    expect(cache.revalidateTag).toHaveBeenCalledWith("site-settings", { expire: 0 });
  });

  it("points at the exact nested field that is wrong", async () => {
    await signIn({ permissions: ["settings.manage"] });
    const result = await updateSiteSettingsAction(
      undefined,
      formOf({ ...valid, "socials.github": "javascript:alert(1)", "footer.columns": JSON.stringify([{ title: "", links: [] }]) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors?.["socials.github"]).toEqual(["Use a full link that starts with https://."]);
      expect(result.fieldErrors?.["footer.columns.0.title"]).toEqual(["Add a column title."]);
    }
  });

  it("refuses images that don't exist", async () => {
    await signIn({ permissions: ["settings.manage"] });
    expect(await updateSiteSettingsAction(undefined, formOf({ ...valid, logoId: "missing" }))).toEqual({
      ok: false,
      error: "One of the images is no longer available. Upload it again.",
    });
  });
});
