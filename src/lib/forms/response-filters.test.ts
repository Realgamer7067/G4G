import { describe, expect, it } from "vitest";
import { buildResponseWhere, parseResponseFilters, responsesQuery } from "./response-filters";

describe("response filters", () => {
  it("parses and validates search params", () => {
    expect(parseResponseFilters({ q: " Priya ", from: "2026-09-01", to: "bad", page: "2" })).toEqual({
      q: "Priya", from: "2026-09-01", to: "", event: "", page: 2,
    });
  });

  it("scopes to the form, lowercases search and uses whole days in the site zone", () => {
    const where = buildResponseWhere("f1", parseResponseFilters({ q: "Priya", from: "2026-09-10", to: "2026-09-10", event: "e1" }), "Asia/Kolkata");
    expect(where).toEqual({
      AND: [
        { formId: "f1" },
        { searchText: { contains: "priya" } },
        { eventId: "e1" },
        { submittedAt: { gte: new Date("2026-09-09T18:30:00.000Z"), lt: new Date("2026-09-10T18:30:00.000Z") } },
      ],
    });
  });

  it("builds query strings for pagination and export links", () => {
    expect(responsesQuery(parseResponseFilters({ q: "x" }), 3)).toBe("?q=x&page=3");
    expect(responsesQuery(parseResponseFilters({}))).toBe("");
  });
});
