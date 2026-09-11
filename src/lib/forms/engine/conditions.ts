import { CHOICE_TYPES, NUMERIC_TYPES, type AnswerValue, type Answers, type Condition, type ConditionGroup, type Field } from "./schema";

const norm = (s: string) => s.trim().toLowerCase();

export function isEmptyValue(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

const asList = (v: AnswerValue | undefined): string[] => (Array.isArray(v) ? v.map(String) : isEmptyValue(v) ? [] : [String(v)]);

/**
 * One condition against the answers so far. A condition on an unanswered (or hidden) question sees an
 * empty value: only is_empty and the negative operators are true for it.
 */
export function evalCondition(c: Condition, answers: Answers, field: Field | undefined): boolean {
  if (!field) return false;
  const v = answers[c.fieldId];
  if (c.op === "is_empty") return isEmptyValue(v);
  if (c.op === "is_filled") return !isEmptyValue(v);
  if (isEmptyValue(v)) return c.op === "not_equals" || c.op === "not_contains" || c.op === "none_of";

  const isChoice = CHOICE_TYPES.has(field.type);
  const isMulti = field.type === "checkboxes";
  const values = asList(v);

  switch (c.op) {
    case "equals":
    case "not_equals": {
      const t = String(c.value ?? "");
      let match: boolean;
      if (isMulti) match = values.includes(t);
      else if (isChoice) match = values[0] === t;
      else if (NUMERIC_TYPES.has(field.type)) match = toNumber(v) !== null && toNumber(v) === toNumber(c.value);
      else match = norm(String(v)) === norm(t);
      return c.op === "equals" ? match : !match;
    }
    case "contains":
    case "not_contains": {
      const t = String(c.value ?? "");
      const match = isMulti ? values.includes(t) : norm(String(v)).includes(norm(t));
      return c.op === "contains" ? match : !match;
    }
    case "any_of":
    case "none_of": {
      const list = Array.isArray(c.value) ? c.value.map(String) : c.value === undefined ? [] : [String(c.value)];
      const match = values.some((x) => list.includes(x));
      return c.op === "any_of" ? match : !match;
    }
    case "gt":
    case "lt": {
      const a = toNumber(v);
      const b = toNumber(c.value);
      if (a === null || b === null) return false;
      return c.op === "gt" ? a > b : a < b;
    }
    case "before":
    case "after": {
      const target = String(c.value ?? "");
      if (!target) return false;
      return c.op === "before" ? String(v) < target : String(v) > target;
    }
  }
}

/** No group (or an empty one) means "always". */
export function evalGroup(group: ConditionGroup | undefined, answers: Answers, fieldsById: ReadonlyMap<string, Field>): boolean {
  if (!group || group.conditions.length === 0) return true;
  const results = group.conditions.map((c) => evalCondition(c, answers, fieldsById.get(c.fieldId)));
  return group.mode === "all" ? results.every(Boolean) : results.some(Boolean);
}
