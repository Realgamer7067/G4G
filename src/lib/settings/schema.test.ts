import { describe, expect, it } from "vitest";
import { footerSchema, hrefSchema, seoSchema, siteSettingsFormSchema, socialsSchema } from "./schema";

describe("hrefSchema", () => {
  it.each(["/events", "/forms/web-team", "https://gfg.example.edu", "mailto:chapter@example.edu", "#contact"])(
    "accepts %s",
    (href) => expect(hrefSchema.safeParse(href).success).toBe(true),
  );
  it.each(["javascript:alert(1)", "//evil.test", "ftp://files.test", "events", " "])("rejects %s", (href) =>
    expect(hrefSchema.safeParse(href).success).toBe(false),
  );
});

describe("socialsSchema", () => {
  it("allows empty links and fills missing networks", () => {
    const parsed = socialsSchema.parse({ instagram: "https://instagram.com/gfg" });
    expect(parsed.instagram).toBe("https://instagram.com/gfg");
    expect(parsed.github).toBe("");
    expect(parsed.custom).toEqual([]);
  });
  it("rejects non-http links", () => {
    expect(socialsSchema.safeParse({ github: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("footerSchema", () => {
  it("limits columns to four", () => {
    const col = { title: "Links", links: [] };
    expect(footerSchema.safeParse({ columns: [col, col, col, col, col] }).success).toBe(false);
    expect(footerSchema.parse({}).columns).toEqual([]);
  });
});

describe("seoSchema", () => {
  it("requires %s in the title template", () => {
    expect(seoSchema.safeParse({ titleTemplate: "GfG Chapter" }).success).toBe(false);
    expect(seoSchema.parse({ titleTemplate: "%s · GfG" }).titleTemplate).toBe("%s · GfG");
  });
});

describe("siteSettingsFormSchema", () => {
  it("parses a complete form and trims text", () => {
    const parsed = siteSettingsFormSchema.parse({
      clubName: "  GeeksforGeeks Student Chapter ",
      shortName: "GfG Chapter",
      tagline: "Build together",
      description: "We build things.",
      universityName: "Your University",
      email: "chapter@example.edu",
      phone: "",
      address: "",
      mapUrl: "",
      timezone: "Asia/Kolkata",
      logoId: "",
      socials: {},
      footer: {},
      seo: { titleTemplate: "%s · GfG", defaultDescription: "" },
      navCta: { label: "", href: "" },
    });
    expect(parsed.clubName).toBe("GeeksforGeeks Student Chapter");
    expect(parsed.logoId).toBeNull();
    expect(parsed.navCta).toBeNull();
  });
  it("rejects an unknown timezone", () => {
    const result = siteSettingsFormSchema.safeParse({ clubName: "X", shortName: "X", timezone: "Mars/Olympus" });
    expect(result.success).toBe(false);
  });
});
