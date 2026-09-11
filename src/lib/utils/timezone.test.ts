import { describe, expect, it } from "vitest";
import { formatInZone, isLocalDateTime, tzOffsetMinutes, utcToZonedInput, zonedDay, zonedToUtc } from "./timezone";

describe("tzOffsetMinutes", () => {
  it("knows IST is +5:30", () => {
    expect(tzOffsetMinutes(new Date("2026-09-10T00:00:00Z"), "Asia/Kolkata")).toBe(330);
  });
  it("tracks daylight saving", () => {
    expect(tzOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(tzOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "America/New_York")).toBe(-240);
  });
});

describe("zonedToUtc", () => {
  it("converts IST wall time", () => {
    expect(zonedToUtc("2026-09-10T18:00", "Asia/Kolkata").toISOString()).toBe("2026-09-10T12:30:00.000Z");
  });
  it("treats a bare date as midnight", () => {
    expect(zonedToUtc("2026-09-10", "Asia/Kolkata").toISOString()).toBe("2026-09-09T18:30:00.000Z");
  });
  it("handles the spring-forward gap and fall-back overlap", () => {
    expect(zonedToUtc("2026-03-08T03:30", "America/New_York").toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(zonedToUtc("2026-11-01T01:30", "America/New_York").toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
  it("rejects malformed input", () => {
    expect(() => zonedToUtc("10/09/2026", "Asia/Kolkata")).toThrow();
  });
});

describe("utcToZonedInput / zonedDay", () => {
  it("round-trips with zonedToUtc", () => {
    const utc = zonedToUtc("2026-12-31T23:45", "Asia/Kolkata");
    expect(utcToZonedInput(utc, "Asia/Kolkata")).toBe("2026-12-31T23:45");
  });
  it("gives the local calendar day", () => {
    expect(zonedDay(new Date("2026-09-09T20:00:00Z"), "Asia/Kolkata")).toBe("2026-09-10");
  });
});

describe("helpers", () => {
  it("validates local strings", () => {
    expect(isLocalDateTime("2026-09-10T18:00")).toBe(true);
    expect(isLocalDateTime("2026-09-10")).toBe(true);
    expect(isLocalDateTime("2026-9-10")).toBe(false);
  });
  it("formats in the zone", () => {
    expect(formatInZone("2026-09-10T12:30:00Z", "Asia/Kolkata", { hour: "2-digit", minute: "2-digit", hour12: false })).toBe("18:00");
  });
});
