import { describe, expect, it } from "vitest";
import { formatEventWhen } from "./format";

const IST = "Asia/Kolkata";

describe("formatEventWhen", () => {
  it("shows one date and a time range for a same-day event, in the site time zone", () => {
    expect(formatEventWhen("2026-10-03T03:30:00Z", "2026-10-03T11:30:00Z", IST)).toEqual({
      date: "Sat, 3 Oct 2026",
      time: "9:00 am – 5:00 pm",
      full: "Sat, 3 Oct 2026 · 9:00 am – 5:00 pm",
    });
  });

  it("keeps an overnight event under 24 hours on one date", () => {
    expect(formatEventWhen("2026-09-25T12:30:00Z", "2026-09-25T19:30:00Z", IST)).toMatchObject({
      date: "Fri, 25 Sep 2026",
      time: "6:00 pm – 1:00 am",
    });
  });

  it("shows a date range for multi-day events", () => {
    expect(formatEventWhen("2026-10-03T03:30:00Z", "2026-10-04T12:30:00Z", IST)).toMatchObject({
      date: "3 Oct – 4 Oct 2026",
      time: "9:00 am – 6:00 pm",
    });
  });

  it("includes both years when they differ", () => {
    expect(formatEventWhen("2026-12-31T12:30:00Z", "2027-01-02T12:30:00Z", IST).date).toBe("31 Dec 2026 – 2 Jan 2027");
  });
});
