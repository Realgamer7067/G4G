import { evalGroup, isEmptyValue } from "./conditions";
import { CHOICE_TYPES, allFields, type AnswerValue, type Answers, type FormDefinition } from "./schema";

export type Evaluation = {
  /** Page ids the respondent goes through, in order. */
  path: string[];
  /** Blocks (questions and content) shown on pages in the path. */
  visibleBlocks: Set<string>;
  /** For choice questions: option ids currently shown, in option order. */
  visibleOptions: Map<string, Set<string>>;
  /** Answers to visible questions only, with now-hidden option selections removed. */
  cleaned: Answers;
};

function isAnswerShape(v: unknown): v is AnswerValue {
  return typeof v === "string" || typeof v === "number" || (Array.isArray(v) && v.every((x) => typeof x === "string"));
}

/**
 * Walks the form like a respondent would. Conditions only see answers that are already visible, so hiding
 * a question cascades to everything that depends on it. Jumps only go forward, so this always terminates.
 */
export function evaluateForm(def: FormDefinition, answers: Answers): Evaluation {
  const fieldsById = new Map(allFields(def).map((f) => [f.id, f]));
  const pageIndex = new Map(def.pages.map((p, i) => [p.id, i]));
  const cleaned: Answers = {};
  const visibleBlocks = new Set<string>();
  const visibleOptions = new Map<string, Set<string>>();
  const path: string[] = [];

  let index = 0;
  while (index < def.pages.length) {
    const page = def.pages[index];
    path.push(page.id);

    for (const block of page.blocks) {
      if (!evalGroup(block.visibleWhen, cleaned, fieldsById)) continue;
      visibleBlocks.add(block.id);
      if (block.kind !== "field") continue;

      let value: AnswerValue | undefined = isAnswerShape(answers[block.id]) ? answers[block.id] : undefined;
      if (CHOICE_TYPES.has(block.type)) {
        const shown = new Set((block.options ?? []).filter((o) => evalGroup(o.visibleWhen, cleaned, fieldsById)).map((o) => o.id));
        visibleOptions.set(block.id, shown);
        if (block.type === "checkboxes" && Array.isArray(value)) value = value.filter((x) => shown.has(x));
        else if (block.type !== "checkboxes" && typeof value === "string" && !shown.has(value)) value = undefined;
      }
      if (!isEmptyValue(value)) cleaned[block.id] = value;
    }

    const branch = page.branches.find((b) => evalGroup(b.when, cleaned, fieldsById));
    const target = branch ? branch.goTo : page.defaultNext;
    if (target === "submit") break;
    const next = target === "next" ? undefined : pageIndex.get(target);
    index = next !== undefined && next > index ? next : index + 1;
  }

  return { path, visibleBlocks, visibleOptions, cleaned };
}
