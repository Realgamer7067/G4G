// src/server/actions/team-domains.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { deleteDomainAction, moveDomainAction, saveDomainAction } = await import("./team-domains");

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("domain actions", () => {
  it("requires team.manage", async () => {
    await signIn({ permissions: ["sponsors.manage"] });
    expect(await saveDomainAction(undefined, formOf({ name: "Robotics" }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
  });

  it("creates domains appended to the end, renames, reorders and deletes with audit and cache refresh", async () => {
    await signIn({ permissions: ["team.manage"] });
    expect(await saveDomainAction(undefined, formOf({ name: "Development" }))).toEqual({ ok: true, data: null });
    expect(await saveDomainAction(undefined, formOf({ name: "Design" }))).toEqual({ ok: true, data: null });
    const dev = await db.domain.findFirstOrThrow({ where: { name: "Development" } });
    const design = await db.domain.findFirstOrThrow({ where: { name: "Design" } });
    expect(dev.order).toBe(0);
    expect(design.order).toBe(1);
    expect(cache.revalidateTag).toHaveBeenCalledWith("team", { expire: 0 });

    expect(await moveDomainAction(undefined, formOf({ id: design.id, direction: "-1" }))).toEqual({ ok: true, data: null });
    expect((await db.domain.findUniqueOrThrow({ where: { id: design.id } })).order).toBe(0);
    expect((await db.domain.findUniqueOrThrow({ where: { id: dev.id } })).order).toBe(1);

    expect(await saveDomainAction(undefined, formOf({ id: dev.id, name: "Dev & Infra" }))).toEqual({ ok: true, data: null });
    expect((await db.domain.findUniqueOrThrow({ where: { id: dev.id } })).name).toBe("Dev & Infra");

    expect(await deleteDomainAction(undefined, formOf({ id: dev.id }))).toEqual({ ok: true, data: null });
    expect(await db.domain.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: { startsWith: "team.domain_" } } })).toBe(5);
  });

  it("appends a new domain after the current max order even after a delete leaves gaps", async () => {
    await signIn({ permissions: ["team.manage"] });
    for (const name of ["Alpha", "Bravo", "Charlie"]) await saveDomainAction(undefined, formOf({ name }));
    const alpha = await db.domain.findFirstOrThrow({ where: { name: "Alpha" } });
    await deleteDomainAction(undefined, formOf({ id: alpha.id }));
    expect(await saveDomainAction(undefined, formOf({ name: "Aardvark" }))).toEqual({ ok: true, data: null });
    const rows = await db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    expect(rows.map((d) => d.name)).toEqual(["Bravo", "Charlie", "Aardvark"]);
    expect(new Set(rows.map((d) => d.order)).size).toBe(3);
    expect(rows[2].order).toBe(3);
  });

  it("refuses to move the only domain in either direction", async () => {
    await signIn({ permissions: ["team.manage"] });
    await saveDomainAction(undefined, formOf({ name: "Solo" }));
    const only = await db.domain.findFirstOrThrow({ where: { name: "Solo" } });
    expect(await moveDomainAction(undefined, formOf({ id: only.id, direction: "-1" }))).toMatchObject({ ok: false });
    expect(await moveDomainAction(undefined, formOf({ id: only.id, direction: "1" }))).toMatchObject({ ok: false });
  });
});
