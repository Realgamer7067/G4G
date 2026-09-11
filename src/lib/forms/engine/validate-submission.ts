import { isEmptyValue, toNumber } from "./conditions";
import { evaluateForm } from "./evaluate";
import type { AnswerValue, Answers, Field, FormDefinition } from "./schema";

export type SubmissionResult = { ok: true; cleaned: Answers; path: string[] } | { ok: false; errors: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS = /^[0-9+\-\s().]+$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UPLOAD_ID = /^[a-z0-9]{6,40}$/;
const DEFAULT_MAX_LENGTH = { short_text: 500, long_text: 5_000 } as const;

const INVALID = "This answer isn't valid.";
const REQUIRED = "This question is required.";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isRealDate(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

type Checked = { value?: AnswerValue; error?: string };

/**
 * Validates and normalises one visible question. Options that exist but are hidden right now are dropped
 * silently (the respondent changed an earlier answer); option ids that don't exist at all are errors.
 */
export function checkField(field: Field, raw: AnswerValue | undefined, visibleOptions: ReadonlySet<string> | undefined): Checked {
  const v = field.validation ?? {};
  const allOptions = new Set((field.options ?? []).map((o) => o.id));
  const shown = visibleOptions ?? allOptions;
  let value = raw;

  if (field.type === "dropdown" || field.type === "radio") {
    if (typeof value === "string" && allOptions.has(value) && !shown.has(value)) value = undefined;
  }
  if (field.type === "checkboxes" && Array.isArray(value)) {
    if (value.some((x) => !allOptions.has(x))) return { error: "Choose from the options shown." };
    value = [...new Set(value)].filter((x) => shown.has(x));
  }
  if (isEmptyValue(value)) return field.required ? { error: REQUIRED } : {};

  switch (field.type) {
    case "short_text":
    case "long_text": {
      if (typeof value !== "string") return { error: INVALID };
      const s = value.trim();
      const max = v.maxLength ?? DEFAULT_MAX_LENGTH[field.type];
      if (v.minLength !== undefined && s.length < v.minLength) return { error: `Use at least ${v.minLength} characters.` };
      if (s.length > max) return { error: `Keep it under ${max} characters.` };
      if (v.pattern === "custom" && v.customPattern) {
        let re: RegExp | null = null;
        try {
          re = new RegExp(v.customPattern);
        } catch {
          re = null;
        }
        if (re && !re.test(s)) return { error: v.patternMessage || "This answer isn't in the expected format." };
      }
      return { value: s };
    }
    case "email": {
      if (typeof value !== "string") return { error: INVALID };
      const s = value.trim().toLowerCase();
      return s.length <= 254 && EMAIL.test(s) ? { value: s } : { error: "Enter a valid email address." };
    }
    case "phone": {
      if (typeof value !== "string") return { error: INVALID };
      const s = value.trim();
      const digits = s.replace(/\D/g, "").length;
      return PHONE_CHARS.test(s) && digits >= 7 && digits <= 15 ? { value: s } : { error: "Enter a valid phone number." };
    }
    case "url": {
      if (typeof value !== "string") return { error: INVALID };
      const s = value.trim();
      return s.length <= 2_000 && isHttpUrl(s) ? { value: s } : { error: "Enter a full link that starts with https://." };
    }
    case "number": {
      if (Array.isArray(value)) return { error: INVALID };
      const n = toNumber(value);
      if (n === null) return { error: "Enter a number." };
      if (v.min !== undefined && n < v.min) return { error: `Enter a number of at least ${v.min}.` };
      if (v.max !== undefined && n > v.max) return { error: `Enter a number of at most ${v.max}.` };
      return { value: n };
    }
    case "date":
      return typeof value === "string" && isRealDate(value.trim()) ? { value: value.trim() } : { error: "Pick a valid date." };
    case "time":
      return typeof value === "string" && TIME.test(value.trim()) ? { value: value.trim() } : { error: "Pick a valid time." };
    case "dropdown":
    case "radio":
      return typeof value === "string" && shown.has(value) ? { value } : { error: "Choose one of the options." };
    case "checkboxes": {
      if (!Array.isArray(value)) return { error: INVALID };
      if (v.minSelections !== undefined && value.length < v.minSelections) return { error: `Choose at least ${v.minSelections}.` };
      if (v.maxSelections !== undefined && value.length > v.maxSelections) return { error: `Choose at most ${v.maxSelections}.` };
      return { value };
    }
    case "linear_scale": {
      const lo = v.scaleMin ?? 1;
      const hi = v.scaleMax ?? 5;
      const n = Array.isArray(value) ? null : toNumber(value);
      return n !== null && Number.isInteger(n) && n >= lo && n <= hi ? { value: n } : { error: `Choose a value from ${lo} to ${hi}.` };
    }
    case "rating": {
      const hi = v.max ?? 5;
      const n = Array.isArray(value) ? null : toNumber(value);
      return n !== null && Number.isInteger(n) && n >= 1 && n <= hi ? { value: n } : { error: `Choose a rating from 1 to ${hi}.` };
    }
    case "yes_no":
      return value === "yes" || value === "no" ? { value } : { error: "Choose yes or no." };
    case "file": {
      if (!Array.isArray(value)) return { error: INVALID };
      const max = v.maxFiles ?? 1;
      const ids = [...new Set(value)];
      if (ids.length > max) return { error: `Upload at most ${max} file${max === 1 ? "" : "s"}.` };
      if (ids.some((id) => !UPLOAD_ID.test(id))) return { error: "One of the files is invalid. Upload it again." };
      return { value: ids };
    }
  }
}

/** Server-authoritative check of a whole submission: only visible questions on the path count. */
export function validateSubmission(def: FormDefinition, answers: Answers): SubmissionResult {
  const ev = evaluateForm(def, answers);
  const errors: Record<string, string> = {};
  const cleaned: Answers = {};
  for (const pageId of ev.path) {
    const page = def.pages.find((p) => p.id === pageId);
    for (const block of page?.blocks ?? []) {
      if (block.kind !== "field" || !ev.visibleBlocks.has(block.id)) continue;
      const result = checkField(block, answers[block.id], ev.visibleOptions.get(block.id));
      if (result.error) errors[block.id] = result.error;
      else if (result.value !== undefined) cleaned[block.id] = result.value;
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, cleaned, path: ev.path };
}

/** Errors for one page, for the wizard's Next button. */
export function validatePage(def: FormDefinition, answers: Answers, pageId: string): Record<string, string> {
  const ev = evaluateForm(def, answers);
  const page = def.pages.find((p) => p.id === pageId);
  const errors: Record<string, string> = {};
  for (const block of page?.blocks ?? []) {
    if (block.kind !== "field" || !ev.visibleBlocks.has(block.id)) continue;
    const result = checkField(block, answers[block.id], ev.visibleOptions.get(block.id));
    if (result.error) errors[block.id] = result.error;
  }
  return errors;
}
