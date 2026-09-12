import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { publishHomepageAction, restoreHomepageRevisionAction, saveHomepageDraftAction } = await import("./homepage");

function ctaSection(heading: string) {
  return { id: "sec_1", type: "cta", enabled: true, content: { heading, ctas: [{ label: "Go", href: "/x", style: "primary" }], backgroundVariant: "gradient" } };
}

beforeEach(async () => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
  cache.revalidatePath.mockClear();
  await db.homepageRevision.deleteMany();
});

describe("saveHomepageDraftAction", () => {
  it("creates and saves a draft", async () => {
    await signIn({ permissions: ["homepage.edit"] });
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [] } });
    const sections = [ctaSection("Join")];

    const result = await saveHomepageDraftAction(draft.id, sections);

    expect(result.ok).toBe(true);
    const row = await db.homepageRevision.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.sections).toEqual(sections);
  });

  it("rejects an invalid draft shape without touching the row", async () => {
    await signIn({ permissions: ["homepage.edit"] });
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [{ id: "sec_1", type: "cta", enabled: true, content: { heading: "Keep me" } }] } });

    const result = await saveHomepageDraftAction(draft.id, [{ id: "sec_1", type: "bogus" }]);

    expect(result.ok).toBe(false);
    const row = await db.homepageRevision.findUniqueOrThrow({ where: { id: draft.id } });
    expect((row.sections as unknown[])[0]).toMatchObject({ type: "cta" });
  });
});

describe("publishHomepageAction", () => {
  it("publishes the current draft, superseding the previous published revision", async () => {
    await signIn({ permissions: ["homepage.edit", "homepage.publish"] });
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [ctaSection("v1")] } });

    const first = await publishHomepageAction(draft.id);
    expect(first.ok).toBe(true);

    await saveHomepageDraftAction(draft.id, [ctaSection("v2")]);
    const second = await publishHomepageAction(draft.id);
    expect(second.ok).toBe(true);

    const revisions = await db.homepageRevision.findMany({ orderBy: { createdAt: "asc" } });
    const statuses = revisions.map((r) => r.status);
    expect(statuses).toContain("SUPERSEDED");
    expect(statuses.filter((s) => s === "PUBLISHED")).toHaveLength(1);
    expect(await db.auditLog.count({ where: { action: "homepage.published" } })).toBe(2);
  });
});

describe("restoreHomepageRevisionAction", () => {
  it("restores an old revision's sections into the draft", async () => {
    await signIn({ permissions: ["homepage.edit", "homepage.publish"] });
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [] } });

    await saveHomepageDraftAction(draft.id, [ctaSection("old")]);
    await publishHomepageAction(draft.id);
    await saveHomepageDraftAction(draft.id, [ctaSection("new")]);

    const published = await db.homepageRevision.findFirstOrThrow({ where: { status: "PUBLISHED" } });
    const result = await restoreHomepageRevisionAction(draft.id, published.id);

    expect(result.ok).toBe(true);
    const row = await db.homepageRevision.findUniqueOrThrow({ where: { id: draft.id } });
    expect((row.sections as { content: { heading: string } }[])[0].content.heading).toBe("old");
    expect(await db.auditLog.count({ where: { action: "homepage.restored" } })).toBe(1);
  });

  it("rejects a historic revision with invalid sections without touching the draft", async () => {
    await signIn({ permissions: ["homepage.edit", "homepage.publish"] });
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [ctaSection("current")] } });
    const bad = await db.homepageRevision.create({ data: { status: "SUPERSEDED", sections: [{ id: "sec_1", type: "bogus" }] } });

    const result = await restoreHomepageRevisionAction(draft.id, bad.id);

    expect(result.ok).toBe(false);
    const row = await db.homepageRevision.findUniqueOrThrow({ where: { id: draft.id } });
    expect((row.sections as { content: { heading: string } }[])[0].content.heading).toBe("current");
    expect(await db.auditLog.count({ where: { action: "homepage.restored" } })).toBe(0);
  });
});
