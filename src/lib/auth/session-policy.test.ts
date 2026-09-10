import { describe, expect, it } from "vitest";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, evaluateSession } from "./session-policy";

const HOUR = 3_600_000;
const t0 = new Date("2026-09-01T00:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("evaluateSession", () => {
  const fresh = { createdAt: t0, lastSeenAt: t0, expiresAt: at(SESSION_IDLE_MS) };

  it("accepts a fresh session without touching it", () => {
    expect(evaluateSession(fresh, true, at(HOUR))).toEqual({ valid: true, touch: false, newExpiresAt: at(HOUR + SESSION_IDLE_MS) });
  });
  it("touches once more than a day has passed since last seen", () => {
    const v = evaluateSession(fresh, true, at(25 * HOUR));
    expect(v).toEqual({ valid: true, touch: true, newExpiresAt: at(25 * HOUR + SESSION_IDLE_MS) });
  });
  it("rejects after the idle expiry", () => {
    expect(evaluateSession(fresh, true, at(SESSION_IDLE_MS + 1)).valid).toBe(false);
  });
  it("never extends past the absolute lifetime", () => {
    const old = { createdAt: t0, lastSeenAt: at(SESSION_ABSOLUTE_MS - 2 * 24 * HOUR), expiresAt: at(SESSION_ABSOLUTE_MS) };
    const v = evaluateSession(old, true, at(SESSION_ABSOLUTE_MS - HOUR));
    expect(v).toEqual({ valid: true, touch: true, newExpiresAt: at(SESSION_ABSOLUTE_MS) });
    expect(evaluateSession(old, true, at(SESSION_ABSOLUTE_MS)).valid).toBe(false);
  });
  it("rejects sessions of deactivated users", () => {
    expect(evaluateSession(fresh, false, at(HOUR)).valid).toBe(false);
  });
});
