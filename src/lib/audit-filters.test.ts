import { describe, expect, it } from "vitest";
import { auditQueryString, buildAuditWhere, parseAuditFilters } from "./audit-filters";

describe("parseAuditFilters", () => {
  it("takes the first value, trims, and validates dates and page", () => {
    expect(parseAuditFilters({ q: [" Code Sprint ", "x"], from: "2026-09-01", to: "bogus", page: "-3" })).toEqual({
      q: "Code Sprint", actor: "", action: "", target: "", from: "2026-09-01", to: "", page: 1,
    });
    expect(parseAuditFilters({ page: "4" }).page).toBe(4);
  });
});

describe("buildAuditWhere", () => {
  const base = parseAuditFilters({});

  it("is empty with no filters", () => {
    expect(buildAuditWhere(base, "Asia/Kolkata")).toEqual({});
  });

  it("searches labels, actor names and actions case-insensitively", () => {
    expect(buildAuditWhere({ ...base, q: "sprint" }, "UTC")).toEqual({
      AND: [
        {
          OR: [
            { targetLabel: { contains: "sprint", mode: "insensitive" } },
            { actorName: { contains: "sprint", mode: "insensitive" } },
            { action: { contains: "sprint", mode: "insensitive" } },
          ],
        },
      ],
    });
  });

  it("matches an action family by prefix and an exact action by equality", () => {
    expect(buildAuditWhere({ ...base, action: "admin" }, "UTC")).toEqual({ AND: [{ action: { startsWith: "admin." } }] });
    expect(buildAuditWhere({ ...base, action: "auth.login" }, "UTC")).toEqual({ AND: [{ action: "auth.login" }] });
  });

  it("uses whole days in the site time zone with an inclusive end date", () => {
    const where = buildAuditWhere({ ...base, from: "2026-09-10", to: "2026-09-10" }, "Asia/Kolkata");
    expect(where).toEqual({
      AND: [{ createdAt: { gte: new Date("2026-09-09T18:30:00.000Z"), lt: new Date("2026-09-10T18:30:00.000Z") } }],
    });
  });

  it("combines actor and target filters", () => {
    expect(buildAuditWhere({ ...base, actor: "u1", target: "Event" }, "UTC")).toEqual({ AND: [{ actorId: "u1" }, { targetType: "Event" }] });
  });
});

describe("auditQueryString", () => {
  it("keeps filters and adds the page", () => {
    expect(auditQueryString({ ...parseAuditFilters({ q: "x", action: "auth" }) }, 3)).toBe("?q=x&action=auth&page=3");
    expect(auditQueryString(parseAuditFilters({}), 1)).toBe("");
  });
});
