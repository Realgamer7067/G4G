import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./origin";

const post = (url: string, origin?: string) =>
  new Request(url, { method: "POST", headers: origin ? { origin } : {} });

describe("isSameOrigin", () => {
  it("accepts a request from the same origin", () => {
    expect(isSameOrigin(post("http://localhost:3000/api/admin/uploads", "http://localhost:3000"))).toBe(true);
  });
  it("rejects a cross-site request", () => {
    expect(isSameOrigin(post("http://localhost:3000/api/admin/uploads", "https://evil.test"))).toBe(false);
  });
  it("rejects a request without an Origin header", () => {
    expect(isSameOrigin(post("http://localhost:3000/api/admin/uploads"))).toBe(false);
  });
  it("accepts the public site origin when running behind a proxy", () => {
    expect(isSameOrigin(post("http://127.0.0.1:3000/api/admin/uploads", "https://gfg.example.edu"), "https://gfg.example.edu")).toBe(true);
  });
  it("rejects a lookalike host", () => {
    expect(isSameOrigin(post("http://localhost:3000/x", "http://localhost:3000.evil.test"))).toBe(false);
  });
});
