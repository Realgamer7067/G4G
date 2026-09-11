import { describe, expect, it } from "vitest";
import { field, options, page } from "./engine/test-fixtures";
import { buildExportTable, safeCell, toCsv } from "./export";

const v1 = {
  id: "v1",
  version: 1,
  definition: { pages: [page("p", [field("name", "short_text", { label: "Name" }), field("old", "short_text", { label: "Old question" })])] },
};
const v2 = {
  id: "v2",
  version: 2,
  definition: {
    pages: [
      page("p", [
        field("name", "short_text", { label: "Full name" }),
        field("year", "radio", { label: "Year", options: [{ id: "y1", label: "First year" }, { id: "y2", label: "Second year" }] }),
        field("stack", "checkboxes", { label: "Stack", options: options("react", "node") }),
      ]),
    ],
  },
};

describe("buildExportTable", () => {
  const table = buildExportTable(
    [v1, v2],
    [
      { id: "r1", versionId: "v1", submittedAt: new Date("2026-09-10T12:30:00Z"), email: null, eventTitle: null, data: { name: "Asha", old: "legacy" } },
      { id: "r2", versionId: "v2", submittedAt: new Date("2026-09-11T04:00:00Z"), email: "b@x.co", eventTitle: "Code Sprint", data: { name: "Ben", year: "y2", stack: ["react", "node"] } },
    ],
    "Asia/Kolkata",
  );

  it("unions columns across versions, latest labels first, retired questions last", () => {
    expect(table.headers).toEqual(["Submitted at", "Email", "Event", "Full name", "Year", "Stack", "Old question"]);
  });

  it("formats times in the site zone and choices as labels", () => {
    expect(table.rows).toEqual([
      ["2026-09-10 18:00", "", "", "Asha", "", "", "legacy"],
      ["2026-09-11 09:30", "b@x.co", "Code Sprint", "Ben", "Second year", "REACT, NODE", ""],
    ]);
  });

  it("omits the Event column when no response came from an event", () => {
    const t = buildExportTable([v1], [{ id: "r", versionId: "v1", submittedAt: new Date(), email: null, eventTitle: null, data: {} }], "UTC");
    expect(t.headers).toEqual(["Submitted at", "Email", "Name", "Old question"]);
  });
});

describe("safeCell", () => {
  it.each(["=SUM(A1:A9)", "+91 98765 43210", "-2+3", "@cmd", "\tx", "\rx"])("neutralises formula-looking %j", (v) => {
    expect(safeCell(v)).toBe(`'${v}`);
  });
  it("leaves normal text alone", () => {
    expect(safeCell("Hello, world")).toBe("Hello, world");
  });
});

describe("toCsv", () => {
  it("quotes where needed, escapes quotes, guards formulas and adds a BOM for Excel", () => {
    const csv = toCsv({ headers: ["A", "B"], rows: [['He said "hi", then left', "=1+1"], ["plain", "line\nbreak"]] });
    expect(csv).toBe('﻿A,B\r\n"He said ""hi"", then left",\'=1+1\r\nplain,"line\nbreak"\r\n');
  });
});
