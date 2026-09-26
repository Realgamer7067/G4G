import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { getCurrentTeam, getPublicTeamByYear, getTeamArchive } = await import("./team");

describe("team data loaders", () => {
  it("returns null when no term is both current and published", async () => {
    await db.teamTerm.create({ data: { label: "2025-26", startYear: 2025, isCurrent: true, isPublished: false } });
    expect(await getCurrentTeam()).toBeNull();
  });

  it("returns the current published term with members sorted by order then name", async () => {
    const term = await db.teamTerm.create({ data: { label: "2026-27", startYear: 2026, isCurrent: true, isPublished: true } });
    await db.teamMember.create({ data: { termId: term.id, name: "Zed", title: "Member", tier: "MEMBER", order: 0 } });
    await db.teamMember.create({ data: { termId: term.id, name: "Amy", title: "Member", tier: "MEMBER", order: 0 } });
    const team = await getCurrentTeam();
    expect(team?.term.label).toBe("2026-27");
    expect(team?.members.map((m) => m.name)).toEqual(["Amy", "Zed"]);
  });

  it("lists only published, non-current terms in the archive, newest first", async () => {
    await db.teamTerm.create({ data: { label: "2024-25", startYear: 2024, isPublished: true } });
    await db.teamTerm.create({ data: { label: "2023-24", startYear: 2023, isPublished: false } });
    await db.teamTerm.create({ data: { label: "2026-27", startYear: 2026, isCurrent: true, isPublished: true } });
    expect((await getTeamArchive()).map((t) => t.startYear)).toEqual([2024]);
  });

  it("serves a specific published year and null for an unpublished or missing one", async () => {
    await db.teamTerm.create({ data: { label: "2024-25", startYear: 2024, isPublished: true } });
    await db.teamTerm.create({ data: { label: "2023-24", startYear: 2023, isPublished: false } });
    expect((await getPublicTeamByYear(2024))?.term.label).toBe("2024-25");
    expect(await getPublicTeamByYear(2023)).toBeNull();
    expect(await getPublicTeamByYear(1999)).toBeNull();
  });
});
