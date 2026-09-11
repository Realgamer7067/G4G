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

const { saveSponsorAction, deleteSponsorAction } = await import("./sponsors");

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("sponsor actions", () => {
  it("require sponsors.manage", async () => {
    await signIn({ permissions: ["events.edit"] });
    expect(await saveSponsorAction(undefined, formOf({ name: "ACME" }))).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("create, update and delete with audit and cache refresh", async () => {
    await signIn({ permissions: ["sponsors.manage"] });
    const created = await saveSponsorAction(
      undefined,
      formOf({ name: "ACME Cloud", website: "https://acme.example", tier: "POWERED_BY", isActive: "on", showOnSponsorsPage: "on", order: "2" }),
    ).catch((e: Error) => e);
    const id = /REDIRECT:\/admin\/sponsors\/([^?]+)\?created=1/.exec(String((created as Error).message))?.[1];
    expect(await db.sponsor.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "ACME Cloud", tier: "POWERED_BY", isActive: true, order: 2 });

    expect(await saveSponsorAction(undefined, formOf({ id: id!, name: "ACME", tier: "TITLE", order: "0" }))).toEqual({ ok: true, data: null });
    expect(await db.sponsor.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "ACME", tier: "TITLE", isActive: false, showOnSponsorsPage: false });
    expect(cache.revalidateTag).toHaveBeenCalledWith("sponsors", { expire: 0 });

    await expect(deleteSponsorAction(undefined, formOf({ id: id! }))).rejects.toThrow("REDIRECT:/admin/sponsors?deleted=1");
    expect(await db.sponsor.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: { startsWith: "sponsor." } } })).toBe(3);
  });

  it("rejects a non-https website", async () => {
    await signIn({ permissions: ["sponsors.manage"] });
    expect(await saveSponsorAction(undefined, formOf({ name: "X", website: "javascript:alert(1)" }))).toMatchObject({
      ok: false,
      fieldErrors: { website: ["Use a full link that starts with https://."] },
    });
  });
});
