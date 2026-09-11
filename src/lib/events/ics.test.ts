import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

const event = {
  uid: "evt_123",
  title: "Code Sprint, 2026; the finale",
  description: "Line one\nLine two",
  startAt: new Date("2026-10-03T03:30:00Z"),
  endAt: new Date("2026-10-03T11:30:00Z"),
  location: "Main Auditorium, Block C",
  url: "https://gfg.example.edu/events/code-sprint",
};

describe("buildIcs", () => {
  const ics = buildIcs(event, new Date("2026-09-01T00:00:00Z"));
  const lines = ics.split("\r\n");

  it("uses CRLF line endings and wraps in a calendar", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines).toContain("BEGIN:VEVENT");
  });

  it("writes UTC timestamps", () => {
    expect(lines).toContain("DTSTART:20261003T033000Z");
    expect(lines).toContain("DTEND:20261003T113000Z");
    expect(lines).toContain("DTSTAMP:20260901T000000Z");
  });

  it("escapes commas, semicolons and newlines", () => {
    expect(lines).toContain("SUMMARY:Code Sprint\\, 2026\\; the finale");
    expect(lines).toContain("DESCRIPTION:Line one\\nLine two");
    expect(lines).toContain("LOCATION:Main Auditorium\\, Block C");
  });

  it("folds lines longer than 75 octets", () => {
    const long = buildIcs({ ...event, description: "x".repeat(200) }, new Date("2026-09-01T00:00:00Z"));
    for (const line of long.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(long).toContain("\r\n x");
  });
});
