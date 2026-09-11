import { describe, expect, it } from "vitest";
import { evalCondition, evalGroup } from "./conditions";
import { cond, field, options, when } from "./test-fixtures";

const text = field("name", "short_text");
const radio = field("year", "radio", { options: options("y1", "y2") });
const boxes = field("stack", "checkboxes", { options: options("react", "node", "figma") });
const num = field("age", "number");
const scale = field("score", "linear_scale", { validation: { scaleMin: 1, scaleMax: 10 } });
const date = field("dob", "date");

describe("evalCondition", () => {
  it("compares text case-insensitively after trimming", () => {
    expect(evalCondition(cond("name", "equals", "yes"), { name: "  Yes " }, text)).toBe(true);
    expect(evalCondition(cond("name", "not_equals", "yes"), { name: "no" }, text)).toBe(true);
    expect(evalCondition(cond("name", "contains", "sprint"), { name: "Code SPRINT 26" }, text)).toBe(true);
    expect(evalCondition(cond("name", "not_contains", "sprint"), { name: "Code Jam" }, text)).toBe(true);
  });

  it("compares choice fields by option id", () => {
    expect(evalCondition(cond("year", "equals", "y1"), { year: "y1" }, radio)).toBe(true);
    expect(evalCondition(cond("year", "any_of", ["y1", "y2"]), { year: "y2" }, radio)).toBe(true);
    expect(evalCondition(cond("year", "none_of", ["y1"]), { year: "y2" }, radio)).toBe(true);
    expect(evalCondition(cond("year", "none_of", ["y1"]), { year: "y1" }, radio)).toBe(false);
  });

  it("treats checkboxes as a set", () => {
    const answers = { stack: ["react", "node"] };
    expect(evalCondition(cond("stack", "equals", "node"), answers, boxes)).toBe(true);
    expect(evalCondition(cond("stack", "contains", "figma"), answers, boxes)).toBe(false);
    expect(evalCondition(cond("stack", "not_contains", "figma"), answers, boxes)).toBe(true);
    expect(evalCondition(cond("stack", "any_of", ["figma", "node"]), answers, boxes)).toBe(true);
    expect(evalCondition(cond("stack", "none_of", ["figma"]), answers, boxes)).toBe(true);
  });

  it("knows empty from filled", () => {
    for (const empty of [undefined, null, "", "   ", []]) {
      expect(evalCondition(cond("name", "is_empty"), { name: empty as never }, text)).toBe(true);
      expect(evalCondition(cond("name", "is_filled"), { name: empty as never }, text)).toBe(false);
    }
    expect(evalCondition(cond("stack", "is_filled"), { stack: ["react"] }, boxes)).toBe(true);
  });

  it("compares numbers, including numeric strings and scales", () => {
    expect(evalCondition(cond("age", "gt", 17), { age: "18" }, num)).toBe(true);
    expect(evalCondition(cond("age", "lt", 17), { age: 18 }, num)).toBe(false);
    expect(evalCondition(cond("score", "gt", 7), { score: 9 }, scale)).toBe(true);
    expect(evalCondition(cond("age", "gt", 1), { age: "abc" }, num)).toBe(false);
    expect(evalCondition(cond("age", "gt", 1), {}, num)).toBe(false);
  });

  it("compares dates", () => {
    expect(evalCondition(cond("dob", "before", "2008-01-01"), { dob: "2006-05-02" }, date)).toBe(true);
    expect(evalCondition(cond("dob", "after", "2008-01-01"), { dob: "2006-05-02" }, date)).toBe(false);
  });
});

describe("evalGroup", () => {
  const fields = new Map([text, radio].map((f) => [f.id, f]));
  it("requires every condition in ALL mode", () => {
    expect(evalGroup(when("all", cond("name", "is_filled"), cond("year", "equals", "y1")), { name: "a", year: "y2" }, fields)).toBe(false);
  });
  it("requires one condition in ANY mode", () => {
    expect(evalGroup(when("any", cond("name", "is_filled"), cond("year", "equals", "y1")), { name: "a", year: "y2" }, fields)).toBe(true);
  });
  it("treats a missing or empty group as always true", () => {
    expect(evalGroup(undefined, {}, fields)).toBe(true);
    expect(evalGroup(when("any"), {}, fields)).toBe(true);
  });
  it("is false when a condition points at an unknown field", () => {
    expect(evalGroup(when("all", cond("ghost", "is_filled")), {}, fields)).toBe(false);
  });
});
