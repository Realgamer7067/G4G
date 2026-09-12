// src/lib/pages/contact-schema.test.ts
import { describe, expect, it } from "vitest";
import { isChecked } from "@/lib/forms-data";
import { contactContentSchema } from "./contact-schema";

describe("contactContentSchema", () => {
  it("defaults to showing only email", () => {
    const result = contactContentSchema.parse({});
    expect(result).toEqual({ intro: "", showEmail: true, showPhone: false, showAddress: false, showMap: false });
  });

  it("persists showEmail: false for a genuinely unchecked box (regression)", () => {
    // Simulates saveContactContentAction's coercion: formDataToObject omits an unchecked
    // checkbox entirely, so `raw.showEmail` is undefined here, exactly like a real unchecked
    // submission. Previously the schema's own `.default(true)` made this impossible to persist.
    const raw: Record<string, unknown> = { intro: "hi", showPhone: "on" };
    const input = contactContentSchema.parse({
      ...raw,
      showEmail: isChecked(raw.showEmail),
      showPhone: isChecked(raw.showPhone),
      showAddress: isChecked(raw.showAddress),
      showMap: isChecked(raw.showMap),
    });
    expect(input).toEqual({ intro: "hi", showEmail: false, showPhone: true, showAddress: false, showMap: false });
  });
});
