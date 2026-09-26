import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { saveAnnouncementAction, setAnnouncementStatusAction, deleteAnnouncementAction } = await import("./announcements");

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("announcement actions", () => {
  it("require announcements.manage", async () => {
    await signIn({ permissions: ["events.edit"] });
    expect(await saveAnnouncementAction(undefined, formOf({ title: "Hi", publishAt: "2026-01-01T00:00" }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
  });

  it("create, publish, unpublish, update and delete with audit and cache refresh", async () => {
    await signIn({ permissions: ["announcements.manage"] });
    const created = await saveAnnouncementAction(
      undefined,
      formOf({ title: "Registrations open", summary: "Sign up now", publishAt: "2026-01-01T09:00", priority: "URGENT", showOnHomepage: "on", showAsBanner: "on" }),
    ).catch((e: Error) => e);
    const id = /REDIRECT:\/admin\/announcements\/([^?]+)\?created=1/.exec(String((created as Error).message))?.[1];
    const row = await db.announcement.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ title: "Registrations open", status: "DRAFT", priority: "URGENT", showOnHomepage: true, showAsBanner: true });
    expect(row.slug).toBe("registrations-open");

    expect(await setAnnouncementStatusAction(undefined, formOf({ id: id!, to: "PUBLISHED" }))).toEqual({ ok: true, data: null });
    expect((await db.announcement.findUniqueOrThrow({ where: { id } })).status).toBe("PUBLISHED");
    expect(cache.revalidateTag).toHaveBeenCalledWith("announcements", { expire: 0 });

    expect(await setAnnouncementStatusAction(undefined, formOf({ id: id!, to: "PUBLISHED" }))).toMatchObject({ ok: false, error: "That announcement is already in that state." });

    expect(await setAnnouncementStatusAction(undefined, formOf({ id: id!, to: "DRAFT" }))).toEqual({ ok: true, data: null });
    expect((await db.announcement.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");

    expect(await saveAnnouncementAction(undefined, formOf({ id: id!, title: "Registrations open", publishAt: "2026-01-01T09:00", priority: "NORMAL" }))).toEqual({
      ok: true,
      data: { id },
    });
    expect((await db.announcement.findUniqueOrThrow({ where: { id } })).priority).toBe("NORMAL");

    await expect(deleteAnnouncementAction(undefined, formOf({ id: id! }))).rejects.toThrow("REDIRECT:/admin/announcements?deleted=1");
    expect(await db.announcement.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: { startsWith: "announcement." } } })).toBe(5);
  });

  it("rejects an expiry before the publish date", async () => {
    await signIn({ permissions: ["announcements.manage"] });
    expect(await saveAnnouncementAction(undefined, formOf({ title: "X", publishAt: "2026-06-01T09:00", expiresAt: "2026-05-01T09:00" }))).toMatchObject({
      ok: false,
      fieldErrors: { expiresAt: ["Must be after the publish date."] },
    });
  });
});
