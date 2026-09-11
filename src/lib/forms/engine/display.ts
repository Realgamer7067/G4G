import { isEmptyValue } from "./conditions";
import { CHOICE_TYPES, type AnswerValue, type Field } from "./schema";

/** Human-readable answer for the review step, response details and exports. */
export function formatAnswer(field: Field, value: AnswerValue | undefined, fileNames: Record<string, string> = {}): string {
  if (isEmptyValue(value)) return "";
  if (CHOICE_TYPES.has(field.type)) {
    const labels = new Map((field.options ?? []).map((o) => [o.id, o.label]));
    const ids = Array.isArray(value) ? value : [String(value)];
    return ids.map((id) => labels.get(id) ?? id).join(", ");
  }
  switch (field.type) {
    case "yes_no":
      return value === "yes" ? "Yes" : "No";
    case "file": {
      const ids = Array.isArray(value) ? value : [String(value)];
      return ids.map((id) => fileNames[id] ?? "Uploaded file").join(", ");
    }
    case "rating":
      return `${value} / ${field.validation?.max ?? 5}`;
    case "linear_scale":
      return `${value} / ${field.validation?.scaleMax ?? 5}`;
    default:
      return Array.isArray(value) ? value.join(", ") : String(value);
  }
}
