import { describe, expect, it } from "vitest";
import { UserError } from "./errors";
import { formDataToObject, isChecked } from "./forms-data";

function fd(entries: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("formDataToObject", () => {
  it("nests dotted keys and parses JSON fields", () => {
    expect(
      formDataToObject(fd([["a", "1"], ["b.c", "2"], ["b.d", "3"], ["j", "[1,2]"]]), ["j"]),
    ).toEqual({ a: "1", b: { c: "2", d: "3" }, j: [1, 2] });
  });
  it("collects repeated keys into arrays", () => {
    expect(formDataToObject(fd([["tag", "x"], ["tag", "y"], ["tag", "z"]]))).toEqual({ tag: ["x", "y", "z"] });
  });
  it("ignores prototype-polluting keys", () => {
    const result = formDataToObject(fd([["__proto__.polluted", "yes"], ["a.constructor.x", "1"], ["ok", "1"]]));
    expect(result).toEqual({ ok: "1" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("reports malformed JSON as a user error", () => {
    expect(() => formDataToObject(fd([["j", "{oops"]]), ["j"])).toThrow(UserError);
  });
  it("skips files", () => {
    const f = new FormData();
    f.append("file", new Blob(["x"]), "x.txt");
    f.append("name", "n");
    expect(formDataToObject(f)).toEqual({ name: "n" });
  });
});

describe("isChecked", () => {
  it("treats on/true as checked and anything else as unchecked", () => {
    expect([isChecked("on"), isChecked("true"), isChecked(true), isChecked(undefined), isChecked(""), isChecked("off")]).toEqual([
      true, true, true, false, false, false,
    ]);
  });
});
