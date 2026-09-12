// src/lib/homepage/sections/ops.test.ts
import { describe, expect, it } from "vitest";
import { blankSection } from "./factories";
import { addSection, moveSection, removeSection, reorderSections, toggleSection, updateSection } from "./ops";
import type { HomepageSections, Section } from "./schema";

function fixture(): HomepageSections {
  return [
    { id: "a", type: "hero", enabled: true, content: { heading: "H", ctas: [], backgroundVariant: "rings", terminalLines: [], showLogoTile: true, showSocials: false } },
    { id: "b", type: "stats", enabled: true, content: { items: [] } },
    { id: "c", type: "cta", enabled: false, content: { heading: "C", ctas: [{ label: "Go", href: "/x", style: "primary" }], backgroundVariant: "gradient" } },
  ];
}

describe("addSection", () => {
  it("appends at the end when afterId is null", () => {
    const next = addSection(fixture(), blankSection("about"), null);
    expect(next.map((s) => s.id).slice(-1)[0]).toBe(next[next.length - 1].id);
    expect(next).toHaveLength(4);
  });

  it("inserts right after the given id", () => {
    const s = blankSection("about");
    const next = addSection(fixture(), s, "a");
    expect(next.map((x) => x.id)).toEqual(["a", s.id, "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = fixture();
    addSection(input, blankSection("about"));
    expect(input).toHaveLength(3);
  });
});

describe("removeSection", () => {
  it("removes the matching section only", () => {
    expect(removeSection(fixture(), "b").map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("is a no-op for an unknown id", () => {
    expect(removeSection(fixture(), "zzz")).toHaveLength(3);
  });
});

describe("moveSection", () => {
  it("swaps with the next section when dir is 1", () => {
    expect(moveSection(fixture(), "a", 1).map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("swaps with the previous section when dir is -1", () => {
    expect(moveSection(fixture(), "c", -1).map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("is a no-op past the array bounds", () => {
    expect(moveSection(fixture(), "a", -1).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(moveSection(fixture(), "c", 1).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("reorderSections", () => {
  it("moves an item from one index to another", () => {
    expect(reorderSections(fixture(), 0, 2).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("is a no-op for out-of-range indexes", () => {
    expect(reorderSections(fixture(), 0, 5)).toHaveLength(3);
  });
});

describe("toggleSection", () => {
  it("flips enabled on the matching section only", () => {
    const next = toggleSection(fixture(), "c");
    expect(next.find((s) => s.id === "c")?.enabled).toBe(true);
    expect(next.find((s) => s.id === "a")?.enabled).toBe(true);
  });
});

describe("updateSection", () => {
  it("merges a content patch without touching other fields", () => {
    const next = updateSection(fixture(), "a", { content: { heading: "New heading" } } as Partial<Omit<Section, "id" | "type">>);
    const a = next.find((s) => s.id === "a");
    expect(a?.type === "hero" && a.content.heading).toBe("New heading");
    expect(a?.type === "hero" && a.content.backgroundVariant).toBe("rings");
  });

  it("replaces top-level fields like headingOverride directly", () => {
    const next = updateSection(fixture(), "b", { headingOverride: "Our numbers" });
    expect(next.find((s) => s.id === "b")?.headingOverride).toBe("Our numbers");
  });

  it("leaves other sections untouched", () => {
    const next = updateSection(fixture(), "a", { content: { heading: "X" } } as Partial<Omit<Section, "id" | "type">>);
    expect(next.find((s) => s.id === "b")).toEqual(fixture()[1]);
  });
});
