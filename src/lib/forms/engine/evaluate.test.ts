import { describe, expect, it } from "vitest";
import { evaluateForm } from "./evaluate";
import { cond, field, options, page, registrationForm, when } from "./test-fixtures";

const def = registrationForm();

describe("evaluateForm: paths and branching", () => {
  it("visits every page by default", () => {
    expect(evaluateForm(def, { year: "y2" }).path).toEqual(["about", "experience", "contact"]);
  });

  it("lets first years skip the experience page", () => {
    const r = evaluateForm(def, { year: "y1", experience: "stale answer from before switching year" });
    expect(r.path).toEqual(["about", "contact"]);
    expect(r.cleaned).not.toHaveProperty("experience");
  });

  it("takes the first matching branch", () => {
    const d = {
      pages: [
        page("a", [field("x", "radio", { options: options("one", "two") })], {
          branches: [
            { id: "b1", when: when("all", cond("x", "is_filled")), goTo: "c" },
            { id: "b2", when: when("all", cond("x", "equals", "one")), goTo: "submit" },
          ],
        }),
        page("b", [field("y", "short_text")]),
        page("c", [field("z", "short_text")]),
      ],
    };
    expect(evaluateForm(d, { x: "one" }).path).toEqual(["a", "c"]);
  });

  it("can end the form early", () => {
    const d = { pages: [page("a", [field("x", "short_text")], { defaultNext: "submit" }), page("b", [field("y", "short_text")])] };
    expect(evaluateForm(d, { y: "never asked" })).toMatchObject({ path: ["a"], cleaned: {} });
  });
});

describe("evaluateForm: field and option visibility", () => {
  it("drops answers to fields that are hidden", () => {
    const r = evaluateForm(def, { year: "y2", domain: "dev", portfolio: "https://dribbble.com/me" });
    expect(r.visibleBlocks.has("portfolio")).toBe(false);
    expect(r.cleaned).not.toHaveProperty("portfolio");
    expect(evaluateForm(def, { year: "y2", domain: "design", portfolio: "https://dribbble.com/me" }).cleaned.portfolio).toBe(
      "https://dribbble.com/me",
    );
  });

  it("filters options by earlier answers", () => {
    expect([...evaluateForm(def, { year: "y1" }).visibleOptions.get("domain")!]).toEqual(["dev", "design"]);
    expect([...evaluateForm(def, { year: "y2" }).visibleOptions.get("domain")!]).toEqual(["dev", "design", "ml"]);
    expect([...evaluateForm(def, { year: "y2", domain: "dev" }).visibleOptions.get("stack")!]).toEqual(["react", "node"]);
  });

  it("drops a selection whose option became hidden, and cascades to dependent fields", () => {
    const r = evaluateForm(def, { year: "y1", domain: "ml", stack: ["react"] });
    expect(r.cleaned).not.toHaveProperty("domain");
    expect(r.visibleBlocks.has("stack")).toBe(false);
    expect(r.cleaned).not.toHaveProperty("stack");
  });

  it("prunes hidden choices out of checkbox answers", () => {
    expect(evaluateForm(def, { year: "y2", domain: "dev", stack: ["react", "figma"] }).cleaned.stack).toEqual(["react"]);
  });

  it("shows content blocks conditionally too", () => {
    expect(evaluateForm(def, { year: "y3" }).visibleBlocks.has("final-note")).toBe(true);
    expect(evaluateForm(def, { year: "y2" }).visibleBlocks.has("final-note")).toBe(false);
  });

  it("ignores answers for fields that don't exist", () => {
    expect(evaluateForm(def, { year: "y2", injected: "x" }).cleaned).toEqual({ year: "y2" });
  });

  it("only lists blocks on pages that are on the path", () => {
    expect(evaluateForm(def, { year: "y1" }).visibleBlocks.has("experience")).toBe(false);
  });
});
