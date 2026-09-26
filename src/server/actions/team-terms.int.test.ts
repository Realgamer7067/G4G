// src/server/actions/team-terms.int.test.ts
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

const { deleteTeamTermAction, saveTeamTermAction, setCurrentTeamTermAction } =
  await import("./team-terms");

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("team term actions", () => {
  it("requires team.manage", async () => {
    await signIn({ permissions: ["sponsors.manage"] });
    expect(
      await saveTeamTermAction(
        undefined,
        formOf({ label: "2026-27", startYear: "2026" }),
      ),
    ).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
  });

  it("makes the first term current automatically, and exactly one term is ever current", async () => {
    await signIn({ permissions: ["team.manage"] });
    expect(
      await saveTeamTermAction(
        undefined,
        formOf({ label: "2025-26", startYear: "2025", isPublished: "on" }),
      ),
    ).toEqual({
      ok: true,
      data: null,
    });
    const first = await db.teamTerm.findFirstOrThrow({
      where: { startYear: 2025 },
    });
    expect(first.isCurrent).toBe(true);
    expect(await db.teamTerm.count({ where: { isCurrent: true } })).toBe(1);

    expect(
      await saveTeamTermAction(
        undefined,
        formOf({ label: "2026-27", startYear: "2026", isPublished: "on" }),
      ),
    ).toEqual({
      ok: true,
      data: null,
    });
    const second = await db.teamTerm.findFirstOrThrow({
      where: { startYear: 2026 },
    });
    expect(second.isCurrent).toBe(false);
    expect(await db.teamTerm.count({ where: { isCurrent: true } })).toBe(1);

    expect(
      await setCurrentTeamTermAction(undefined, formOf({ id: second.id })),
    ).toEqual({ ok: true, data: null });
    expect(await db.teamTerm.count({ where: { isCurrent: true } })).toBe(1);
    expect(
      (await db.teamTerm.findUniqueOrThrow({ where: { id: second.id } }))
        .isCurrent,
    ).toBe(true);
    expect(
      (await db.teamTerm.findUniqueOrThrow({ where: { id: first.id } }))
        .isCurrent,
    ).toBe(false);
    expect(cache.revalidateTag).toHaveBeenCalledWith("team", { expire: 0 });
  });

  it("rejects a duplicate start year as a field error", async () => {
    await signIn({ permissions: ["team.manage"] });
    await saveTeamTermAction(
      undefined,
      formOf({ label: "2025-26", startYear: "2025" }),
    );
    expect(
      await saveTeamTermAction(
        undefined,
        formOf({ label: "Another", startYear: "2025" }),
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        startYear: ["A term with that start year already exists."],
      },
    });
  });

  it("refuses to delete the current term", async () => {
    await signIn({ permissions: ["team.manage"] });
    await saveTeamTermAction(
      undefined,
      formOf({ label: "2025-26", startYear: "2025" }),
    );
    const term = await db.teamTerm.findFirstOrThrow({
      where: { startYear: 2025 },
    });
    expect(
      await deleteTeamTermAction(undefined, formOf({ id: term.id })),
    ).toMatchObject({
      ok: false,
      error:
        "You can't delete the current term. Set another term as current first.",
    });
  });

  it("deletes a non-current term and redirects", async () => {
    await signIn({ permissions: ["team.manage"] });
    await saveTeamTermAction(
      undefined,
      formOf({ label: "2025-26", startYear: "2025" }),
    );
    await saveTeamTermAction(
      undefined,
      formOf({ label: "2026-27", startYear: "2026" }),
    );
    const term = await db.teamTerm.findFirstOrThrow({
      where: { startYear: 2026 },
    });
    await expect(
      deleteTeamTermAction(undefined, formOf({ id: term.id })),
    ).rejects.toThrow("REDIRECT:/admin/team?deleted=1");
    expect(await db.teamTerm.count()).toBe(1);
  });
});
