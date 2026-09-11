import { describe, expect, it } from "vitest";
import type { FormDefinition } from "./schema";
import { field, options, page, registrationForm } from "./test-fixtures";
import { validatePage, validateSubmission } from "./validate-submission";

const one = (f: ReturnType<typeof field>): FormDefinition => ({ pages: [page("p", [f])] });
const errorFor = (def: FormDefinition, value: unknown) => {
  const r = validateSubmission(def, { x: value as never });
  return r.ok ? null : r.errors.x;
};

describe("validateSubmission: requirements follow visibility", () => {
  const def = registrationForm();

  it("requires visible required fields", () => {
    const r = validateSubmission(def, { year: "y2", domain: "dev" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.experience).toBe("This question is required.");
      expect(r.errors.email).toBe("This question is required.");
    }
  });

  it("does not require fields on skipped pages", () => {
    const r = validateSubmission(def, { year: "y1", domain: "dev", email: "a@b.co", consent: "yes" });
    expect(r).toMatchObject({ ok: true, path: ["about", "contact"] });
  });

  it("returns cleaned, normalised answers", () => {
    const r = validateSubmission(def, {
      year: "y2",
      domain: "dev",
      stack: ["react", "react", "figma"],
      portfolio: "https://hidden.example",
      experience: "  Built a thing  ",
      email: " A@B.co ",
      consent: "yes",
    });
    expect(r).toEqual({
      ok: true,
      path: ["about", "experience", "contact"],
      cleaned: { year: "y2", domain: "dev", stack: ["react"], experience: "Built a thing", email: "a@b.co", consent: "yes" },
    });
  });
});

describe("validateSubmission: per-type rules", () => {
  it("text lengths and custom patterns", () => {
    const f = field("x", "short_text", { validation: { minLength: 3, maxLength: 5 } });
    expect(errorFor(one(f), "ab")).toBe("Use at least 3 characters.");
    expect(errorFor(one(f), "abcdef")).toBe("Keep it under 5 characters.");
    const p = field("x", "short_text", { validation: { pattern: "custom", customPattern: "^[0-9]{2}[A-Z]{3}[0-9]{5}$", patternMessage: "Use your registration number, like 22BCE10345." } });
    expect(errorFor(one(p), "22bce1")).toBe("Use your registration number, like 22BCE10345.");
    expect(errorFor(one(p), "22BCE10345")).toBeNull();
  });

  it("email, phone and url formats", () => {
    expect(errorFor(one(field("x", "email")), "not-an-email")).toBe("Enter a valid email address.");
    expect(errorFor(one(field("x", "phone")), "12ab")).toBe("Enter a valid phone number.");
    expect(errorFor(one(field("x", "phone")), "+91 98765 43210")).toBeNull();
    expect(errorFor(one(field("x", "url")), "javascript:alert(1)")).toBe("Enter a full link that starts with https://.");
  });

  it("numbers and ranges", () => {
    const f = field("x", "number", { validation: { min: 1, max: 10 } });
    expect(errorFor(one(f), "abc")).toBe("Enter a number.");
    expect(errorFor(one(f), "0")).toBe("Enter a number of at least 1.");
    expect(errorFor(one(f), "11")).toBe("Enter a number of at most 10.");
    const r = validateSubmission(one(f), { x: "7" });
    expect(r.ok && r.cleaned.x).toBe(7);
  });

  it("dates and times", () => {
    expect(errorFor(one(field("x", "date")), "10/09/2026")).toBe("Pick a valid date.");
    expect(errorFor(one(field("x", "time")), "25:00")).toBe("Pick a valid time.");
    expect(errorFor(one(field("x", "time")), "18:30")).toBeNull();
  });

  it("single and multiple choice", () => {
    const radio = field("x", "radio", { options: options("a", "b") });
    expect(errorFor(one(radio), "zzz")).toBe("Choose one of the options.");
    const boxes = field("x", "checkboxes", { options: options("a", "b", "c", "d"), validation: { minSelections: 2, maxSelections: 3 } });
    expect(errorFor(one(boxes), ["a"])).toBe("Choose at least 2.");
    expect(errorFor(one(boxes), ["a", "b", "c", "d"])).toBe("Choose at most 3.");
    expect(errorFor(one(boxes), ["a", "zzz"])).toBe("Choose from the options shown.");
  });

  it("scales, ratings and yes/no", () => {
    const scale = field("x", "linear_scale", { validation: { scaleMin: 1, scaleMax: 5 } });
    expect(errorFor(one(scale), 6)).toBe("Choose a value from 1 to 5.");
    expect(errorFor(one(field("x", "rating")), 0)).toBe("Choose a rating from 1 to 5.");
    expect(errorFor(one(field("x", "yes_no")), "maybe")).toBe("Choose yes or no.");
  });

  it("file answers are lists of upload ids within the limit", () => {
    const f = field("x", "file", { required: true, validation: { maxFiles: 2 } });
    expect(errorFor(one(f), [])).toBe("This question is required.");
    expect(errorFor(one(f), ["cmabc1", "cmabc2", "cmabc3"])).toBe("Upload at most 2 files.");
    expect(errorFor(one(f), ["../etc/passwd"])).toBe("One of the files is invalid. Upload it again.");
  });

  it("rejects wrong value shapes instead of crashing", () => {
    expect(errorFor(one(field("x", "short_text", { required: true })), ["array"])).toBe("This answer isn't valid.");
    expect(errorFor(one(field("x", "checkboxes", { options: options("a") })), "a")).toBe("This answer isn't valid.");
  });
});

describe("validatePage", () => {
  it("only checks the given page's visible questions", () => {
    const def = registrationForm();
    expect(validatePage(def, { year: "y2", domain: "dev" }, "about")).toEqual({});
    expect(validatePage(def, { year: "y2" }, "about")).toEqual({ domain: "This question is required." });
    expect(validatePage(def, {}, "contact")).toEqual({ email: "This question is required.", consent: "This question is required." });
  });
});
