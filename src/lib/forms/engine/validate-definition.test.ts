import { describe, expect, it } from "vitest";
import type { FormDefinition } from "./schema";
import { cond, content, field, options, page, registrationForm, when } from "./test-fixtures";
import { validateDefinition } from "./validate-definition";

function issues(def: FormDefinition) {
  const r = validateDefinition(def);
  return r.ok ? [] : r.issues.map((i) => i.message);
}
const has = (def: FormDefinition, fragment: string) => expect(issues(def).some((m) => m.includes(fragment))).toBe(true);

describe("validateDefinition", () => {
  it("accepts a well-formed form", () => {
    expect(validateDefinition(registrationForm())).toEqual({ ok: true });
  });

  it("rejects a malformed shape", () => {
    expect(validateDefinition({ pages: "nope" } as unknown as FormDefinition).ok).toBe(false);
  });

  it("needs at least one question", () => {
    has({ pages: [page("a", [content("c")])] }, "Add at least one question");
  });

  it("needs unique ids", () => {
    has({ pages: [page("a", [field("x", "short_text"), field("x", "email")])] }, "used more than once");
    has({ pages: [page("a", [field("x", "short_text")]), page("a", [field("y", "short_text")])] }, "used more than once");
  });

  it("needs options on choice questions", () => {
    has({ pages: [page("a", [field("x", "radio", { options: [] })])] }, "needs at least one option");
  });

  it("only lets logic depend on earlier questions", () => {
    has(
      { pages: [page("a", [field("x", "short_text", { visibleWhen: when("all", cond("y", "is_filled")) }), field("y", "short_text")])] },
      "comes later",
    );
    has(
      {
        pages: [
          page("a", [field("x", "radio", { options: [{ id: "o", label: "O", visibleWhen: when("all", cond("x", "is_filled")) }] })]),
        ],
      },
      "comes later",
    );
  });

  it("checks operators fit the question type", () => {
    has({ pages: [page("a", [field("x", "short_text"), field("y", "short_text", { visibleWhen: when("all", cond("x", "gt", 3)) })])] }, "can't be used");
  });

  it("checks option-based conditions reference real options", () => {
    has(
      { pages: [page("a", [field("x", "radio", { options: options("a") }), field("y", "short_text", { visibleWhen: when("all", cond("x", "equals", "zzz")) })])] },
      "isn't an option",
    );
  });

  it("only allows jumps forward to existing pages", () => {
    const back = registrationForm();
    back.pages[2].branches = [{ id: "loop", when: when("all", cond("consent", "is_filled")), goTo: "about" }];
    has(back, "can only jump forward");
    const ghost = registrationForm();
    ghost.pages[0].defaultNext = "nowhere";
    has(ghost, "doesn't exist");
  });

  it("checks scales and custom patterns", () => {
    has({ pages: [page("a", [field("s", "linear_scale", { validation: { scaleMin: 5, scaleMax: 5 } })])] }, "lowest value must be below");
    has({ pages: [page("a", [field("t", "short_text", { validation: { pattern: "custom", customPattern: "([a-z" } })])] }, "pattern isn't valid");
  });
});
