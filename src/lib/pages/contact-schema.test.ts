// src/lib/pages/contact-schema.test.ts
import { describe, expect, it } from "vitest";
import { contactContentSchema } from "./contact-schema";

describe("contactContentSchema", () => {
  it("defaults to showing only email", () => {
    const result = contactContentSchema.parse({});
    expect(result).toEqual({ intro: "", showEmail: true, showPhone: false, showAddress: false, showMap: false });
  });
});
