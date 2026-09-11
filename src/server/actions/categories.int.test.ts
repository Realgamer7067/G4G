import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { saveCategoryAction, deleteCategoryAction } = await import("./categories");

beforeEach(() => resetMockRequest());

describe("category actions", () => {
  it("require events.edit", async () => {
    await signIn({ permissions: ["events.create"] });
    expect(await saveCategoryAction(undefined, formOf({ name: "Workshop" }))).toEqual({ ok: false, error: "You don't have permission to do that." });
    await expect(deleteCategoryAction(formOf({ id: "x" }))).rejects.toThrow("You don't have permission to do that.");
  });

  it("creates with a unique slug, renames, and deletes leaving events uncategorised", async () => {
    await signIn({ permissions: ["events.edit"] });
    await saveCategoryAction(undefined, formOf({ name: "Workshop" }));
    await saveCategoryAction(undefined, formOf({ name: "Workshop!" }));
    const [a, b] = await db.eventCategory.findMany({ orderBy: { order: "asc" } });
    expect([a.slug, b.slug]).toEqual(["workshop", "workshop-2"]);

    expect(await saveCategoryAction(undefined, formOf({ id: b.id, name: "Talks" }))).toEqual({ ok: true, data: null });
    expect((await db.eventCategory.findUniqueOrThrow({ where: { id: b.id } })).slug).toBe("talks");

    const event = await db.event.create({ data: { slug: "e", title: "E", startAt: new Date(), endAt: new Date(Date.now() + 3600_000), categoryId: a.id } });
    await deleteCategoryAction(formOf({ id: a.id }));
    expect((await db.event.findUniqueOrThrow({ where: { id: event.id } })).categoryId).toBeNull();
    expect(await db.auditLog.count({ where: { action: { startsWith: "category." } } })).toBe(4);
  });
});
