import { describe, expect, it } from "vitest";
import { isLikelyBot, normalizePagePath } from "./page-view";

describe("normalizePagePath", () => {
  it("accepts public pages and strips query, hash and trailing slash", () => {
    expect(normalizePagePath("/")).toBe("/");
    expect(normalizePagePath("/events")).toBe("/events");
    expect(normalizePagePath("/events/")).toBe("/events");
    expect(normalizePagePath("/events/git-workshop?utm=x#top")).toBe("/events/git-workshop");
    expect(normalizePagePath("/Events/Git-Workshop")).toBe("/events/git-workshop");
    expect(normalizePagePath("/events/git-workshop/register")).toBe("/events/git-workshop/register");
    expect(normalizePagePath("/team/2025")).toBe("/team/2025");
  });

  it("rejects admin, api, media and unknown roots", () => {
    for (const p of ["/admin", "/admin/events", "/api/v", "/media/2026/x.webp", "/_next/static/x.js", "/wp-login.php", "/secret"]) {
      expect(normalizePagePath(p)).toBeNull();
    }
  });

  it("rejects malformed, deep or oversized input", () => {
    expect(normalizePagePath("events")).toBeNull();
    expect(normalizePagePath(42)).toBeNull();
    expect(normalizePagePath(null)).toBeNull();
    expect(normalizePagePath("/events/a/b/c")).toBeNull();
    expect(normalizePagePath(`/events/${"a".repeat(81)}`)).toBeNull();
    expect(normalizePagePath(`/${"x".repeat(301)}`)).toBeNull();
    expect(normalizePagePath("/events/bad%20slug")).toBeNull();
    expect(normalizePagePath("/events/../admin")).toBeNull();
  });
});

describe("isLikelyBot", () => {
  it("flags crawlers, tools and missing agents", () => {
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isLikelyBot("curl/8.4.0")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/131.0")).toBe(true);
    expect(isLikelyBot(null)).toBe(true);
    expect(isLikelyBot("")).toBe(true);
  });

  it("lets ordinary browsers through", () => {
    expect(isLikelyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36")).toBe(false);
    expect(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});
