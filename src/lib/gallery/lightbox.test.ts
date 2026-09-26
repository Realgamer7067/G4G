import { describe, expect, it } from "vitest";
import { wrapIndex } from "./lightbox";

describe("wrapIndex", () => {
  it("advances within range", () => {
    expect(wrapIndex(0, 5, 1)).toBe(1);
    expect(wrapIndex(3, 5, 1)).toBe(4);
  });

  it("wraps past the end forward", () => {
    expect(wrapIndex(4, 5, 1)).toBe(0);
  });

  it("wraps past the start backward", () => {
    expect(wrapIndex(0, 5, -1)).toBe(4);
  });

  it("handles an empty gallery", () => {
    expect(wrapIndex(0, 0, 1)).toBe(0);
  });
});
