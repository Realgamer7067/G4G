import { describe, expect, it } from "vitest";
import { dailySeries, lastDays, topPaths } from "./summary";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("lastDays", () => {
  it("returns the window oldest first, crossing month ends", () => {
    expect(lastDays("2026-10-02", 4)).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("dailySeries", () => {
  it("sums per day, fills gaps with zero and ignores days outside the window", () => {
    const days = lastDays("2026-09-27", 3);
    const rows = [
      { date: d("2026-09-25"), views: 2 },
      { date: d("2026-09-25"), views: 3 },
      { date: d("2026-09-27"), views: 1 },
      { date: d("2026-09-20"), views: 99 },
    ];
    expect(dailySeries(rows, days)).toEqual([
      { day: "2026-09-25", views: 5 },
      { day: "2026-09-26", views: 0 },
      { day: "2026-09-27", views: 1 },
    ]);
  });
});

describe("topPaths", () => {
  it("totals across days and ranks by views then path", () => {
    const rows = [
      { path: "/events", views: 3 },
      { path: "/", views: 5 },
      { path: "/events", views: 4 },
      { path: "/about", views: 5 },
    ];
    expect(topPaths(rows, 2)).toEqual([
      { path: "/events", views: 7 },
      { path: "/", views: 5 },
    ]);
  });
});
