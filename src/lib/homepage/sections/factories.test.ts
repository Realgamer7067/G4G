// src/lib/homepage/sections/factories.test.ts
import { describe, expect, it } from "vitest";
import { blankSection, newSectionId } from "./factories";
import { SECTION_TYPES } from "./schema";
import { sectionSchema } from "./schema";

describe("blankSection", () => {
  for (const type of SECTION_TYPES) {
    it(`produces a schema-valid ${type} section`, () => {
      expect(sectionSchema.safeParse(blankSection(type)).success).toBe(true);
    });
  }

  it("gives every blank section a unique id", () => {
    const ids = new Set(SECTION_TYPES.map((t) => blankSection(t).id));
    expect(ids.size).toBe(SECTION_TYPES.length);
  });
});

describe("newSectionId", () => {
  it("is prefixed and reasonably unique", () => {
    const a = newSectionId();
    const b = newSectionId();
    expect(a).toMatch(/^sec_/);
    expect(a).not.toBe(b);
  });
});
