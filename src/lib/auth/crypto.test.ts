import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { generateToken, hashToken } from "./tokens";

describe("password hashing", () => {
  it("produces an argon2id hash that verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
  });
  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword(hash, "wrong horse battery")).toBe(false);
  });
  it("returns false instead of throwing on a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("requires at least 12 characters", () => {
    expect(passwordProblem("short")).toBe("Use at least 12 characters.");
  });
  it("caps length at 256", () => {
    expect(passwordProblem("a".repeat(257))).toBe("Use at most 256 characters.");
  });
  it("accepts a reasonable passphrase", () => {
    expect(passwordProblem("green pine night 42")).toBeNull();
  });
});

describe("tokens", () => {
  it("generates url-safe random tokens of 32 bytes", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("hashes deterministically to 64 hex chars", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
