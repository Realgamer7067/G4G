// src/lib/pages/about-schema.test.ts
import { describe, expect, it } from "vitest";
import { aboutContentSchema } from "./about-schema";

describe("aboutContentSchema", () => {
  it("fills in defaults for an empty object", () => {
    const result = aboutContentSchema.parse({});
    expect(result).toEqual({ heading: "", body: "", imageId: null });
  });

  it("rejects a body over 4000 characters", () => {
    expect(aboutContentSchema.safeParse({ body: "x".repeat(4001) }).success).toBe(false);
  });
});
