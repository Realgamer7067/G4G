import { describe, expect, it } from "vitest";
import { homepageSectionsSchema, sectionSchema } from "./schema";

describe("sectionSchema", () => {
  it("accepts a minimal valid hero section", () => {
    const result = sectionSchema.safeParse({
      id: "sec_1",
      type: "hero",
      enabled: true,
      content: { heading: "Build with us" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a hero section with no heading", () => {
    const result = sectionSchema.safeParse({ id: "sec_1", type: "hero", enabled: true, content: {} });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown section type", () => {
    const result = sectionSchema.safeParse({ id: "sec_1", type: "banner", enabled: true, content: {} });
    expect(result.success).toBe(false);
  });

  it("rejects more than 2 CTAs on a hero section", () => {
    const cta = { label: "Go", href: "/x", style: "primary" as const };
    const result = sectionSchema.safeParse({
      id: "sec_1",
      type: "hero",
      enabled: true,
      content: { heading: "H", ctas: [cta, cta, cta] },
    });
    expect(result.success).toBe(false);
  });

  it("caps the whole sections array at 40 entries", () => {
    const one = { id: "sec_1", type: "social" as const, enabled: true, content: {} };
    const result = homepageSectionsSchema.safeParse(Array.from({ length: 41 }, () => one));
    expect(result.success).toBe(false);
  });

  it("parses a full realistic sections array", () => {
    const result = homepageSectionsSchema.safeParse([
      { id: "sec_1", type: "hero", enabled: true, content: { heading: "Build with us", ctas: [{ label: "Join", href: "/join", style: "primary" }] } },
      { id: "sec_2", type: "stats", enabled: true, content: { items: [{ id: "st_1", label: "Events", value: null, source: "events_completed" }] } },
      { id: "sec_3", type: "cta", enabled: false, content: { heading: "Ready?", ctas: [{ label: "Apply", href: "/apply", style: "primary" }] } },
    ]);
    expect(result.success).toBe(true);
  });
});
