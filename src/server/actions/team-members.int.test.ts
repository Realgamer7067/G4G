// src/server/actions/team-members.int.test.ts
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

const {
  copyTeamMembersFromPreviousTermAction,
  deleteTeamMemberAction,
  moveTeamMemberAction,
  saveTeamMemberAction,
} = await import("./team-members");

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

async function makeTerm(startYear: number, label = `${startYear}`) {
  return db.teamTerm.create({ data: { label, startYear } });
}

describe("team member actions", () => {
  it("requires team.manage", async () => {
    await signIn({ permissions: ["sponsors.manage"] });
    const term = await makeTerm(2026);
    expect(
      await saveTeamMemberAction(
        undefined,
        formOf({
          termId: term.id,
          name: "Ada",
          title: "Lead",
          tier: "LEAD",
          order: "0",
        }),
      ),
    ).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("creates, updates and deletes a member with nested links", async () => {
    await signIn({ permissions: ["team.manage"] });
    const term = await makeTerm(2026);
    const created = await saveTeamMemberAction(
      undefined,
      formOf({
        termId: term.id,
        name: "Ada Lovelace",
        title: "Chapter Lead",
        tier: "LEAD",
        order: "0",
        "links.linkedin": "https://linkedin.com/in/ada",
        featured: "on",
      }),
    ).catch((e: Error) => e);
    const id = /REDIRECT:\/admin\/team\/[^/]+\/([^?]+)\?created=1/.exec(
      String((created as Error).message),
    )?.[1];
    const row = await db.teamMember.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({
      name: "Ada Lovelace",
      tier: "LEAD",
      featured: true,
    });
    expect(row.links).toMatchObject({
      linkedin: "https://linkedin.com/in/ada",
    });
    expect(cache.revalidateTag).toHaveBeenCalledWith("team", { expire: 0 });

    expect(
      await saveTeamMemberAction(
        undefined,
        formOf({
          id: id!,
          termId: term.id,
          name: "Ada L.",
          title: "Chapter Lead",
          tier: "LEAD",
          order: "0",
        }),
      ),
    ).toEqual({ ok: true, data: null });
    expect(
      (await db.teamMember.findUniqueOrThrow({ where: { id } })).name,
    ).toBe("Ada L.");

    await expect(
      deleteTeamMemberAction(undefined, formOf({ id: id! })),
    ).rejects.toThrow(`REDIRECT:/admin/team/${term.id}?deleted=1`);
    expect(await db.teamMember.count()).toBe(0);
  });

  it("reorders within a term+tier+domain group even when every row starts at order 0", async () => {
    await signIn({ permissions: ["team.manage"] });
    const term = await makeTerm(2026);
    const a = await db.teamMember.create({
      data: {
        termId: term.id,
        name: "Amy",
        title: "Member",
        tier: "MEMBER",
        order: 0,
      },
    });
    const b = await db.teamMember.create({
      data: {
        termId: term.id,
        name: "Bob",
        title: "Member",
        tier: "MEMBER",
        order: 0,
      },
    });
    const c = await db.teamMember.create({
      data: {
        termId: term.id,
        name: "Cid",
        title: "Member",
        tier: "MEMBER",
        order: 0,
      },
    });

    expect(
      await moveTeamMemberAction(
        undefined,
        formOf({ id: c.id, direction: "-1" }),
      ),
    ).toEqual({ ok: true, data: null });
    const ordered = await db.teamMember.findMany({
      where: { termId: term.id },
      orderBy: { order: "asc" },
    });
    expect(ordered.map((m) => m.id)).toEqual([a.id, c.id, b.id]);
    expect(ordered.map((m) => m.order)).toEqual([0, 1, 2]);
  });

  it("copies members from the previous term once, and refuses a second copy or copying with no earlier term", async () => {
    await signIn({ permissions: ["team.manage"] });
    const prev = await makeTerm(2025, "2025-26");
    await db.teamMember.create({
      data: {
        termId: prev.id,
        name: "Ada",
        title: "Lead",
        tier: "LEAD",
        order: 0,
      },
    });
    const target = await makeTerm(2026, "2026-27");

    const copied = await copyTeamMembersFromPreviousTermAction(
      undefined,
      formOf({ termId: target.id }),
    );
    expect(copied).toEqual({ ok: true, data: { copied: 1 } });
    expect(await db.teamMember.count({ where: { termId: target.id } })).toBe(1);

    expect(
      await copyTeamMembersFromPreviousTermAction(
        undefined,
        formOf({ termId: target.id }),
      ),
    ).toMatchObject({
      ok: false,
      error:
        "This term already has members. Copying only works into an empty term.",
    });

    const oldest = await makeTerm(2020, "2020-21");
    expect(
      await copyTeamMembersFromPreviousTermAction(
        undefined,
        formOf({ termId: oldest.id }),
      ),
    ).toMatchObject({
      ok: false,
      error: "There's no earlier term to copy from.",
    });
  });
});
