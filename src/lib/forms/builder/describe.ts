import { OPERATOR_LABELS } from "../engine/validate-definition";
import { CHOICE_TYPES, type Condition, type ConditionGroup, type Field } from "../engine/schema";

/** Plain-language summary of one condition, for the builder's inspector. */
export function describeCondition(c: Condition, fieldsById: ReadonlyMap<string, Field>): string {
  const field = fieldsById.get(c.fieldId);
  const label = field ? `“${field.label}”` : "that question";
  const opLabel = OPERATOR_LABELS[c.op];
  if (c.op === "is_empty" || c.op === "is_filled") return `${label} ${opLabel}`;

  const optionLabel = (id: string) => field?.options?.find((o) => o.id === id)?.label ?? id;
  if (field && CHOICE_TYPES.has(field.type) && (c.op === "any_of" || c.op === "none_of")) {
    const ids = Array.isArray(c.value) ? c.value : c.value !== undefined ? [String(c.value)] : [];
    return `${label} ${opLabel} ${ids.length ? ids.map(optionLabel).join(", ") : "…"}`;
  }
  if (field && CHOICE_TYPES.has(field.type)) return `${label} ${opLabel} “${optionLabel(String(c.value ?? ""))}”`;
  return `${label} ${opLabel} “${c.value ?? ""}”`;
}

/** Plain-language summary of a whole group, e.g. "“Domain” is “Design” AND “Year” is not “Y1”". No group means always. */
export function describeGroup(group: ConditionGroup | undefined, fieldsById: ReadonlyMap<string, Field>): string {
  if (!group || group.conditions.length === 0) return "Always shown";
  const joiner = group.mode === "all" ? " and " : " or ";
  return group.conditions.map((c) => describeCondition(c, fieldsById)).join(joiner);
}
