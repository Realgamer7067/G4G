import { describe, expect, it } from "vitest";
import { cond, content, field, options, page, registrationForm, when } from "../engine/test-fixtures";
import { validateDefinition } from "../engine/validate-definition";
import { blankField, blankOption, blankPage } from "./factories";
import {
  addBranch,
  addOption,
  addPage,
  duplicateBlock,
  duplicateOption,
  duplicatePage,
  earlierFields,
  fieldsThroughPage,
  laterPages,
  moveBlock,
  movePage,
  removeBlock,
  removeOption,
  removePage,
  updateBlock,
} from "./ops";

describe("removeBlock", () => {
  it("drops the block and strips every condition that referenced it", () => {
    const def = registrationForm();
    const next = removeBlock(def, "about", "domain");
    const about = next.pages[0];
    expect(about.blocks.find((b) => b.id === "domain")).toBeUndefined();
    // "ml" option's visibleWhen referenced "year", untouched.
    // "stack"'s visibleWhen referenced "domain" (is_filled) -> now always shown (undefined).
    const stack = about.blocks.find((b) => b.id === "stack")!;
    expect(stack.visibleWhen).toBeUndefined();
    // "react"/"node" options' visibleWhen referenced "domain equals dev" -> dropped entirely (single condition).
    expect(stack.kind === "field" && stack.options?.find((o) => o.id === "react")?.visibleWhen).toBeUndefined();
    // "portfolio"'s visibleWhen referenced "domain equals design" -> dropped.
    const portfolio = about.blocks.find((b) => b.id === "portfolio")!;
    expect(portfolio.visibleWhen).toBeUndefined();
    expect(validateDefinition(next)).toEqual({ ok: true });
  });

  it("removes a branch entirely when its only condition referenced the deleted field", () => {
    const def = registrationForm();
    const next = removeBlock(def, "about", "year");
    // branch b1 ("year equals y1" -> contact) had one condition on "year" -> branch dropped.
    expect(next.pages[0].branches).toHaveLength(0);
    expect(validateDefinition(next)).toEqual({ ok: true });
  });

  it("keeps a branch and drops only the offending condition when other conditions remain", () => {
    const def = { pages: [page("p1", [field("a", "short_text"), field("b", "short_text")], { branches: [{ id: "br", when: when("all", cond("a", "is_filled"), cond("b", "is_filled")), goTo: "submit" }] })] };
    const next = removeBlock(def, "p1", "a");
    expect(next.pages[0].branches).toHaveLength(1);
    expect(next.pages[0].branches[0].when.conditions).toEqual([{ fieldId: "b", op: "is_filled" }]);
  });
});

describe("removeOption", () => {
  it("drops the option and removes it from any_of/none_of lists, shrinking but keeping the condition", () => {
    const def = { pages: [page("p1", [field("a", "checkboxes", { options: options("x", "y", "z") }), field("b", "short_text", { visibleWhen: when("all", cond("a", "any_of", ["x", "y"])) })])] };
    const next = removeOption(def, "p1", "a", "x");
    const a = next.pages[0].blocks[0];
    expect(a.kind === "field" && a.options?.map((o) => o.id)).toEqual(["y", "z"]);
    const b = next.pages[0].blocks[1];
    expect(b.visibleWhen?.conditions).toEqual([{ fieldId: "a", op: "any_of", value: ["y"] }]);
  });

  it("drops the whole condition when removing the option empties its value list", () => {
    const def = { pages: [page("p1", [field("a", "radio", { options: options("x", "y") }), field("b", "short_text", { visibleWhen: when("all", cond("a", "equals", "x")) })])] };
    const next = removeOption(def, "p1", "a", "x");
    expect(next.pages[0].blocks[1].visibleWhen).toBeUndefined();
    expect(validateDefinition(next)).toEqual({ ok: true });
  });
});

describe("removePage", () => {
  it("retargets branches and defaultNext pointing at the removed page back to next", () => {
    const def = {
      pages: [
        page("p1", [field("a", "short_text")], { branches: [{ id: "br", when: when("all", cond("a", "is_filled")), goTo: "p3" }], defaultNext: "p2" }),
        page("p2", [field("b", "short_text")], { defaultNext: "p3" }),
        page("p3", [field("c", "short_text")]),
      ],
    };
    const next = removePage(def, "p2");
    expect(next.pages.map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(next.pages[0].defaultNext).toBe("next");
    expect(validateDefinition(next)).toEqual({ ok: true });
  });

  it("refuses to remove the last page", () => {
    const def = { pages: [page("only", [field("a", "short_text")])] };
    expect(removePage(def, "only")).toBe(def);
  });
});

describe("duplicatePage", () => {
  it("gives the copy fresh ids and rewrites in-page conditions, leaving cross-page ones alone", () => {
    const def = registrationForm();
    const next = duplicatePage(def, "about");
    expect(next.pages).toHaveLength(4);
    const copy = next.pages[1];
    expect(copy.id).not.toBe("about");
    const originalDomainOption = def.pages[0].blocks[1];
    const copiedDomain = copy.blocks[1];
    expect(originalDomainOption.kind === "field" && copiedDomain.kind === "field" && copiedDomain.id !== originalDomainOption.id).toBe(true);
    // The copied "stack" field's visibleWhen referenced the copied "domain", not the original.
    const copiedStack = copy.blocks.find((b) => b.kind === "field" && b.label === "stack")!;
    expect(copiedDomain.kind === "field" && copiedStack.visibleWhen?.conditions[0].fieldId).toBe(copiedDomain.id);
    // The whole thing is still a valid, self-consistent definition.
    expect(validateDefinition(next)).toEqual({ ok: true });
  });

  it("is a no-op for an unknown page id", () => {
    const def = registrationForm();
    expect(duplicatePage(def, "nope")).toBe(def);
  });
});

describe("duplicateBlock and duplicateOption", () => {
  it("clones a choice field with fresh option ids, needing no condition remap", () => {
    const def = { pages: [page("p1", [field("a", "radio", { options: options("x", "y") })])] };
    const next = duplicateBlock(def, "p1", "a");
    expect(next.pages[0].blocks).toHaveLength(2);
    const copy = next.pages[0].blocks[1];
    expect(copy.id).not.toBe("a");
    expect(copy.kind === "field" && copy.options?.map((o) => o.id)).not.toEqual(["x", "y"]);
    expect(validateDefinition(next)).toEqual({ ok: true });
  });

  it("clones an option in place", () => {
    const def = { pages: [page("p1", [field("a", "radio", { options: options("x", "y") })])] };
    const next = duplicateOption(def, "p1", "a", "x");
    const a = next.pages[0].blocks[0];
    expect(a.kind === "field" && a.options).toHaveLength(3);
    expect(a.kind === "field" && a.options?.[1].id).not.toBe("x");
    expect(validateDefinition(next)).toEqual({ ok: true });
  });
});

describe("moveBlock and movePage", () => {
  it("swaps neighbours and clamps at the edges", () => {
    const def = { pages: [page("p1", [field("a", "short_text"), field("b", "short_text")])] };
    expect(moveBlock(def, "p1", "a", 1).pages[0].blocks.map((b) => b.id)).toEqual(["b", "a"]);
    expect(moveBlock(def, "p1", "a", -1).pages[0].blocks.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("moves a page", () => {
    const def = { pages: [page("p1", [field("a", "short_text")]), page("p2", [field("b", "short_text")])] };
    expect(movePage(def, "p1", 1).pages.map((p) => p.id)).toEqual(["p2", "p1"]);
  });
});

describe("addPage, addOption, addBranch, updateBlock", () => {
  it("adds a page after the given one and keeps the form valid", () => {
    const def = { pages: [page("p1", [field("a", "short_text")])] };
    const next = addPage(def, blankPage(2), "p1");
    expect(next.pages.map((p) => p.id)).toEqual(["p1", next.pages[1].id]);
    expect(validateDefinition(next)).toEqual({ ok: true });
  });

  it("adds an option to a choice field", () => {
    const def = { pages: [page("p1", [field("a", "radio", { options: options("x") })])] };
    const next = addOption(def, "p1", "a", blankOption(2));
    const a = next.pages[0].blocks[0];
    expect(a.kind === "field" && a.options).toHaveLength(2);
  });

  it("adds a branch and updates a block", () => {
    const def = { pages: [page("p1", [field("a", "short_text")], { defaultNext: "submit" })] };
    const withBranch = addBranch(def, "p1", { id: "br", when: when("all", cond("a", "is_filled")), goTo: "submit" });
    expect(withBranch.pages[0].branches).toHaveLength(1);
    const updated = updateBlock(withBranch, "p1", "a", { required: true });
    const updatedBlock = updated.pages[0].blocks[0];
    expect(updatedBlock.kind === "field" && updatedBlock.required).toBe(true);
  });

  it("blankField produces a valid, non-empty-labelled field for every type", () => {
    for (const type of ["short_text", "radio", "checkboxes", "linear_scale", "rating", "file"] as const) {
      const f = blankField(type);
      expect(f.label.length).toBeGreaterThan(0);
      const def = { pages: [page("p1", [f, field("email", "email", { required: true })])] };
      expect(validateDefinition(def)).toEqual({ ok: true });
    }
  });
});

describe("selectors", () => {
  it("earlierFields matches validateDefinition's earlier-only rule", () => {
    const def = registrationForm();
    const before = earlierFields(def, "portfolio").map((f) => f.id);
    expect(before).toEqual(["year", "domain", "stack"]);
  });

  it("fieldsThroughPage includes every field up to and including the given page", () => {
    const def = registrationForm();
    expect(fieldsThroughPage(def, "about").map((f) => f.id)).toEqual(["year", "domain", "stack", "portfolio"]);
  });

  it("laterPages only offers pages after the given one", () => {
    const def = registrationForm();
    expect(laterPages(def, "about").map((p) => p.id)).toEqual(["experience", "contact"]);
    expect(laterPages(def, "contact")).toEqual([]);
  });
});

describe("content block", () => {
  it("survives removeBlock cleanup unaffected when unrelated", () => {
    const def = { pages: [page("p1", [field("a", "short_text"), content("note", { visibleWhen: when("all", cond("a", "is_filled")) })])] };
    const next = removeBlock(def, "p1", "a");
    expect(next.pages[0].blocks.find((b) => b.id === "note")!.visibleWhen).toBeUndefined();
  });
});
