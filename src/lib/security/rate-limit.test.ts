import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit within the window", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(rl.check("k", 0)).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
    expect(rl.check("k", 10).remaining).toBe(1);
    expect(rl.check("k", 20).remaining).toBe(0);
    const blocked = rl.check("k", 30);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(970);
  });
  it("frees slots as old hits slide out of the window", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 1000 });
    rl.check("k", 0);
    rl.check("k", 500);
    expect(rl.check("k", 999).allowed).toBe(false);
    expect(rl.check("k", 1000).allowed).toBe(true);
  });
  it("keeps keys independent", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.check("a", 0).allowed).toBe(true);
    expect(rl.check("b", 0).allowed).toBe(true);
    expect(rl.check("a", 1).allowed).toBe(false);
  });
  it("reset clears a key", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    rl.check("a", 0);
    rl.reset("a");
    expect(rl.check("a", 1).allowed).toBe(true);
  });
  it("evicts the least recently used key beyond maxKeys", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 10_000, maxKeys: 2 });
    rl.check("a", 0);
    rl.check("b", 1);
    rl.check("c", 2); // evicts "a"
    expect(rl.check("a", 3).allowed).toBe(true);
  });
});
