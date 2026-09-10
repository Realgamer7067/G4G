import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Hackathon 2026!")).toBe("hackathon-2026");
  });
  it("spells out ampersands", () => {
    expect(slugify("Git & GitHub Workshop")).toBe("git-and-github-workshop");
  });
  it("strips accents and surrounding whitespace", () => {
    expect(slugify("  Café Déjà vu  ")).toBe("cafe-deja-vu");
  });
  it("returns empty string for symbols only", () => {
    expect(slugify("!!!")).toBe("");
  });
  it("truncates without leaving a trailing hyphen", () => {
    expect(slugify("alpha beta gamma", 11)).toBe("alpha-beta");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", async () => {
    expect(await uniqueSlug("orientation", async () => false)).toBe("orientation");
  });
  it("appends the first free numeric suffix", async () => {
    const taken = new Set(["devfest", "devfest-2"]);
    expect(await uniqueSlug("devfest", async (s) => taken.has(s))).toBe("devfest-3");
  });
  it("falls back to 'item' for an empty base", async () => {
    expect(await uniqueSlug("", async () => false)).toBe("item");
  });
});
