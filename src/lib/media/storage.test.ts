import { describe, expect, it } from "vitest";
import { contentTypeFor, mediaUrl, newStorageKey, resolveInside } from "./storage";

describe("newStorageKey", () => {
  it("groups by year and month", () => {
    expect(newStorageKey(new Date("2026-03-05T10:00:00Z"), "abc")).toBe("2026/03/abc");
  });
  it("generates a uuid by default", () => {
    expect(newStorageKey()).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}$/);
  });
});

describe("resolveInside", () => {
  const root = "/srv/uploads";
  it("joins safe parts", () => {
    expect(resolveInside(root, "2026/03/abc", "w400.webp")).toBe("/srv/uploads/2026/03/abc/w400.webp");
  });
  it.each([["../etc/passwd"], ["/etc/passwd"], ["2026/../../x"], ["2026\\..\\..\\x"]])("rejects %s", (part) => {
    expect(resolveInside(root, part)).toBeNull();
  });
  it("rejects the root itself", () => {
    expect(resolveInside(root, ".")).toBeNull();
  });
});

describe("contentTypeFor", () => {
  it.each([
    ["w400.avif", "image/avif"],
    ["w400.webp", "image/webp"],
    ["og.jpg", "image/jpeg"],
    ["w200.png", "image/png"],
    ["original.jpeg", "image/jpeg"],
    ["notes.txt", "application/octet-stream"],
  ])("%s → %s", (file, type) => expect(contentTypeFor(file)).toBe(type));
});

describe("mediaUrl", () => {
  it("builds the public path", () => {
    expect(mediaUrl("2026/03/abc", "w400.webp")).toBe("/media/2026/03/abc/w400.webp");
  });
});
