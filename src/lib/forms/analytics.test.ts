import { describe, expect, it } from "vitest";
import { choiceBreakdown, dailySeries } from "./analytics";
import { field, options } from "./engine/test-fixtures";

describe("dailySeries", () => {
  it("counts per day in the site zone and fills gaps with zero", () => {
    const now = new Date("2026-09-10T10:00:00Z"); // 15:30 IST, 10 Sep
    const dates = [
      new Date("2026-09-10T02:00:00Z"), // 10 Sep IST
      new Date("2026-09-09T20:00:00Z"), // 10 Sep 01:30 IST
      new Date("2026-09-08T10:00:00Z"), // 8 Sep IST
      new Date("2026-08-01T10:00:00Z"), // outside the window
    ];
    expect(dailySeries(dates, 3, "Asia/Kolkata", now)).toEqual([
      { day: "2026-09-08", count: 1 },
      { day: "2026-09-09", count: 0 },
      { day: "2026-09-10", count: 2 },
    ]);
  });
});

describe("choiceBreakdown", () => {
  it("counts single and multiple choice answers in option order", () => {
    const radio = field("year", "radio", { options: options("y1", "y2") });
    expect(choiceBreakdown(radio, ["y2", "y2", "y1", undefined])).toEqual([
      { id: "y1", label: "Y1", count: 1 },
      { id: "y2", label: "Y2", count: 2 },
    ]);
    const boxes = field("stack", "checkboxes", { options: options("react", "node") });
    expect(choiceBreakdown(boxes, [["react", "node"], ["react"], []])).toEqual([
      { id: "react", label: "REACT", count: 2 },
      { id: "node", label: "NODE", count: 1 },
    ]);
  });

  it("handles yes/no questions", () => {
    expect(choiceBreakdown(field("c", "yes_no"), ["yes", "no", "yes"])).toEqual([
      { id: "yes", label: "Yes", count: 2 },
      { id: "no", label: "No", count: 1 },
    ]);
  });
});
