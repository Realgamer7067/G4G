import { toNumber } from "./conditions";
import { CHOICE_TYPES, formDefinitionSchema, type ConditionGroup, type Field, type FieldType, type Operator } from "./schema";

export type DefinitionIssue = { path: string; message: string };

const TEXT_OPS: Operator[] = ["equals", "not_equals", "contains", "not_contains", "is_empty", "is_filled"];
const SINGLE_CHOICE_OPS: Operator[] = ["equals", "not_equals", "any_of", "none_of", "is_empty", "is_filled"];
const MULTI_CHOICE_OPS: Operator[] = ["equals", "contains", "not_contains", "any_of", "none_of", "is_empty", "is_filled"];
const NUMBER_OPS: Operator[] = ["equals", "not_equals", "gt", "lt", "is_empty", "is_filled"];
const DATE_OPS: Operator[] = ["equals", "not_equals", "before", "after", "is_empty", "is_filled"];

export const OPERATORS_FOR: Record<FieldType, Operator[]> = {
  short_text: TEXT_OPS,
  long_text: TEXT_OPS,
  email: TEXT_OPS,
  phone: TEXT_OPS,
  url: TEXT_OPS,
  dropdown: SINGLE_CHOICE_OPS,
  radio: SINGLE_CHOICE_OPS,
  checkboxes: MULTI_CHOICE_OPS,
  number: NUMBER_OPS,
  linear_scale: NUMBER_OPS,
  rating: NUMBER_OPS,
  date: DATE_OPS,
  time: DATE_OPS,
  yes_no: ["equals", "not_equals", "is_empty", "is_filled"],
  file: ["is_empty", "is_filled"],
};

export const OPERATOR_LABELS: Record<Operator, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "doesn't contain",
  any_of: "is any of",
  none_of: "is none of",
  is_empty: "is empty",
  is_filled: "is answered",
  gt: "is more than",
  lt: "is less than",
  before: "is before",
  after: "is after",
};

/** Builder-time checks. Publishing is blocked until this returns ok. */
export function validateDefinition(input: unknown): { ok: true } | { ok: false; issues: DefinitionIssue[] } {
  const parsed = formDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  }
  const def = parsed.data;
  const issues: DefinitionIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  // Page ids (used by jumps) and block ids (used by conditions and answers) are separate namespaces.
  const pageIds = new Set<string>();
  const blockIds = new Set<string>();
  const everyFieldId = new Set(def.pages.flatMap((p) => p.blocks.filter((b) => b.kind === "field").map((b) => b.id)));
  const pageIndex = new Map<string, number>();
  const unique = (seen: Set<string>, id: string, path: string) => {
    if (seen.has(id)) add(path, `The id “${id}” is used more than once.`);
    seen.add(id);
  };

  def.pages.forEach((p, i) => {
    unique(pageIds, p.id, `pages.${i}`);
    if (!pageIndex.has(p.id)) pageIndex.set(p.id, i);
  });
  if (everyFieldId.size === 0) add("pages", "Add at least one question.");

  const earlier = new Map<string, Field>();
  const checkGroup = (group: ConditionGroup | undefined, path: string, where: string) => {
    for (const [ci, c] of (group?.conditions ?? []).entries()) {
      const at = `${path}.conditions.${ci}`;
      const target = earlier.get(c.fieldId);
      if (!target) {
        add(at, everyFieldId.has(c.fieldId) ? `${where} uses a question that comes later in the form.` : `${where} uses a question that doesn't exist.`);
        continue;
      }
      if (!OPERATORS_FOR[target.type].includes(c.op)) {
        add(at, `“${OPERATOR_LABELS[c.op]}” can't be used with the question “${target.label}”.`);
        continue;
      }
      if (c.op === "is_empty" || c.op === "is_filled") continue;
      const values = Array.isArray(c.value) ? c.value : c.value === undefined || c.value === "" ? [] : [String(c.value)];
      if (values.length === 0) {
        add(at, `${where} needs a value to compare with.`);
        continue;
      }
      if (CHOICE_TYPES.has(target.type)) {
        const optionIds = new Set((target.options ?? []).map((o) => o.id));
        for (const v of values) if (!optionIds.has(String(v))) add(at, `“${v}” isn't an option of “${target.label}”.`);
      }
      if ((c.op === "gt" || c.op === "lt") && toNumber(c.value) === null) add(at, `${where} needs a number to compare with.`);
    }
  };

  const checkTarget = (target: string, pi: number, path: string, pageTitle: string) => {
    if (target === "submit" || target === "next") return;
    const t = pageIndex.get(target);
    if (t === undefined) add(path, `Page “${pageTitle}” jumps to a page that doesn't exist.`);
    else if (t <= pi) add(path, `Page “${pageTitle}” can only jump forward to a later page.`);
  };

  def.pages.forEach((page, pi) => {
    const pageTitle = page.title || `Page ${pi + 1}`;
    page.blocks.forEach((block, bi) => {
      const path = `pages.${pi}.blocks.${bi}`;
      unique(blockIds, block.id, path);
      checkGroup(block.visibleWhen, `${path}.visibleWhen`, block.kind === "field" ? `The rule on “${block.label}”` : "A content block rule");
      if (block.kind !== "field") return;

      const v = block.validation ?? {};
      if (CHOICE_TYPES.has(block.type)) {
        if (!block.options?.length) add(path, `“${block.label}” needs at least one option.`);
        const optionIds = new Set<string>();
        for (const [oi, o] of (block.options ?? []).entries()) {
          if (optionIds.has(o.id)) add(`${path}.options.${oi}`, `The option id “${o.id}” is used more than once in “${block.label}”.`);
          optionIds.add(o.id);
          checkGroup(o.visibleWhen, `${path}.options.${oi}.visibleWhen`, `The rule on option “${o.label}”`);
        }
        if (v.minSelections !== undefined && v.maxSelections !== undefined && v.minSelections > v.maxSelections) {
          add(path, `“${block.label}”: the minimum selections can't be more than the maximum.`);
        }
      }
      if (block.type === "linear_scale" && (v.scaleMin ?? 1) >= (v.scaleMax ?? 5)) add(path, `“${block.label}”: the lowest value must be below the highest.`);
      if (v.minLength !== undefined && v.maxLength !== undefined && v.minLength > v.maxLength) {
        add(path, `“${block.label}”: the minimum length can't be more than the maximum.`);
      }
      if (v.min !== undefined && v.max !== undefined && v.min > v.max) add(path, `“${block.label}”: the minimum can't be more than the maximum.`);
      if (v.pattern === "custom") {
        let valid = Boolean(v.customPattern);
        try {
          if (v.customPattern) new RegExp(v.customPattern);
        } catch {
          valid = false;
        }
        if (!valid) add(path, `“${block.label}”: the custom pattern isn't valid.`);
      }
      earlier.set(block.id, block);
    });

    const branchIds = new Set<string>();
    page.branches.forEach((b, bi) => {
      const path = `pages.${pi}.branches.${bi}`;
      if (branchIds.has(b.id)) add(path, `A jump rule id on page “${pageTitle}” is used more than once.`);
      branchIds.add(b.id);
      checkGroup(b.when, `${path}.when`, `A jump rule on page “${pageTitle}”`);
      checkTarget(b.goTo, pi, path, pageTitle);
    });
    checkTarget(page.defaultNext, pi, `pages.${pi}.defaultNext`, pageTitle);
  });

  return issues.length ? { ok: false, issues } : { ok: true };
}
