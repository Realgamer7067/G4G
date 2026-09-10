import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

const now = new Date("2026-09-10T12:00:00Z");

describe("timeAgo", () => {
  it("says just now under 45 seconds", () => {
    expect(timeAgo(new Date("2026-09-10T11:59:30Z"), now)).toBe("just now");
  });
  it("uses minutes, hours and days", () => {
    expect(timeAgo(new Date("2026-09-10T11:55:00Z"), now)).toBe("5 minutes ago");
    expect(timeAgo(new Date("2026-09-10T10:00:00Z"), now)).toBe("2 hours ago");
    expect(timeAgo(new Date("2026-09-09T12:00:00Z"), now)).toBe("yesterday");
  });
  it("handles future dates", () => {
    expect(timeAgo(new Date("2026-09-10T15:00:00Z"), now)).toBe("in 3 hours");
  });
});
