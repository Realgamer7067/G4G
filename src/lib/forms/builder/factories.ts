import { newId } from "../defaults";
import { CHOICE_TYPES, type Branch, type ContentBlock, type Field, type FieldType, type Option, type Page } from "../engine/schema";

/**
 * Blank builder-time values. Field labels and option labels default to non-empty text: the definition
 * schema requires both (`min(1)`), and an empty label would make `saveFormDraftAction` reject the whole
 * draft — silently freezing autosave until the admin notices and fixes it.
 */
export function blankOption(n: number): Option {
  return { id: newId("opt"), label: `Option ${n}` };
}

export function blankField(type: FieldType): Field {
  const base: Field = { id: newId("q"), kind: "field", type, label: "Untitled question", required: false };
  if (CHOICE_TYPES.has(type)) return { ...base, options: [blankOption(1), blankOption(2)] };
  if (type === "linear_scale") return { ...base, validation: { scaleMin: 1, scaleMax: 5 } };
  if (type === "rating") return { ...base, validation: { max: 5 } };
  if (type === "file") return { ...base, validation: { maxFiles: 1, maxFileMb: 5 } };
  return base;
}

export type ContentType = ContentBlock["type"];

export function blankContent(type: ContentType): ContentBlock {
  const base = { id: newId("c"), kind: "content" as const, type };
  switch (type) {
    case "heading":
      return { ...base, text: "Heading" };
    case "callout":
      return { ...base, text: "Note", tone: "info" as const };
    case "divider":
    case "image":
      return base;
    default:
      return { ...base, text: "Add some text." };
  }
}

export function blankPage(n: number): Page {
  return { id: newId("page"), title: `Part ${n}`, description: "", blocks: [], branches: [], defaultNext: "next" };
}

export function blankBranch(goTo: string): Branch {
  return { id: newId("branch"), when: { mode: "all", conditions: [] }, goTo };
}
