import { describe, expect, it } from "vitest";
import { parseRequestMeta } from "./request-meta";

describe("parseRequestMeta", () => {
  it("prefers x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "10.0.0.2", "x-forwarded-for": "1.1.1.1, 10.0.0.1", "user-agent": "UA" });
    expect(parseRequestMeta(h)).toEqual({ ip: "10.0.0.2", userAgent: "UA" });
  });
  it("falls back to the first x-forwarded-for entry", () => {
    expect(parseRequestMeta(new Headers({ "x-forwarded-for": " 1.1.1.1 , 10.0.0.1" })).ip).toBe("1.1.1.1");
  });
  it("returns nulls when headers are absent", () => {
    expect(parseRequestMeta(new Headers())).toEqual({ ip: null, userAgent: null });
  });
  it("truncates long user agents to 512 characters", () => {
    expect(parseRequestMeta(new Headers({ "user-agent": "x".repeat(900) })).userAgent).toHaveLength(512);
  });
});
