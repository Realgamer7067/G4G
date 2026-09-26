// src/lib/announcements/visibility.test.ts
import { describe, expect, it } from "vitest";
import { dismissalKey, isAnnouncementVisible, selectBannerAnnouncement, type BannerCandidate } from "./visibility";

const now = new Date("2026-09-26T12:00:00Z");
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("isAnnouncementVisible", () => {
  it("is visible when published, publishAt has passed and there's no expiry", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(-1), expiresAt: null }, now)).toBe(true);
  });

  it("is hidden while still a draft", () => {
    expect(isAnnouncementVisible({ status: "DRAFT", publishAt: hoursFromNow(-1), expiresAt: null }, now)).toBe(false);
  });

  it("is hidden before publishAt", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(1), expiresAt: null }, now)).toBe(false);
  });

  it("is visible exactly at publishAt", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: now, expiresAt: null }, now)).toBe(true);
  });

  it("is hidden once expiresAt has passed", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(-2), expiresAt: hoursFromNow(-1) }, now)).toBe(false);
  });

  it("is hidden exactly at expiresAt and visible right before it", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(-2), expiresAt: now }, now)).toBe(false);
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(-2), expiresAt: hoursFromNow(1) }, now)).toBe(true);
  });
});

const banner = (over: Partial<BannerCandidate>): BannerCandidate => ({
  id: "a",
  status: "PUBLISHED",
  publishAt: hoursFromNow(-1),
  expiresAt: null,
  showAsBanner: true,
  priority: "NORMAL",
  updatedAt: now,
  ...over,
});

describe("selectBannerAnnouncement", () => {
  it("returns null when nothing is eligible", () => {
    expect(selectBannerAnnouncement([], now)).toBeNull();
    expect(selectBannerAnnouncement([banner({ showAsBanner: false })], now)).toBeNull();
    expect(selectBannerAnnouncement([banner({ status: "DRAFT" })], now)).toBeNull();
  });

  it("picks the highest priority among eligible banners", () => {
    const rows = [banner({ id: "normal", priority: "NORMAL" }), banner({ id: "urgent", priority: "URGENT" }), banner({ id: "important", priority: "IMPORTANT" })];
    expect(selectBannerAnnouncement(rows, now)?.id).toBe("urgent");
  });

  it("breaks ties on the most recently published", () => {
    const rows = [banner({ id: "older", priority: "IMPORTANT", publishAt: hoursFromNow(-5) }), banner({ id: "newer", priority: "IMPORTANT", publishAt: hoursFromNow(-1) })];
    expect(selectBannerAnnouncement(rows, now)?.id).toBe("newer");
  });

  it("ignores banners outside their visibility window", () => {
    const rows = [banner({ id: "expired", priority: "URGENT", expiresAt: hoursFromNow(-1) }), banner({ id: "live", priority: "NORMAL" })];
    expect(selectBannerAnnouncement(rows, now)?.id).toBe("live");
  });
});

describe("dismissalKey", () => {
  it("combines id and updatedAt so an edit re-shows a dismissed banner", () => {
    const a = { id: "x1", updatedAt: new Date("2026-01-01T00:00:00Z") };
    expect(dismissalKey(a)).toBe("x1:2026-01-01T00:00:00.000Z");
    expect(dismissalKey({ ...a, updatedAt: new Date("2026-02-01T00:00:00Z") })).not.toBe(dismissalKey(a));
  });

  it("accepts an already-serialised ISO string, for use in client components", () => {
    expect(dismissalKey({ id: "x1", updatedAt: "2026-01-01T00:00:00.000Z" })).toBe("x1:2026-01-01T00:00:00.000Z");
  });
});
