"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CHOICE_TYPES, NUMERIC_TYPES, TEMPORAL_TYPES, type Condition, type ConditionGroup, type Field } from "@/lib/forms/engine/schema";
import { OPERATORS_FOR, OPERATOR_LABELS } from "@/lib/forms/engine/validate-definition";
import { cn } from "@/lib/utils/cn";

function ConditionValueInput({ field, condition, onChange }: { field: Field | undefined; condition: Condition; onChange: (value: Condition["value"]) => void }) {
  if (!field || condition.op === "is_empty" || condition.op === "is_filled") return null;

  if (field.type === "yes_no") {
    return (
      <Select aria-label="Value" value={typeof condition.value === "string" ? condition.value : ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </Select>
    );
  }

  if (CHOICE_TYPES.has(field.type)) {
    if (condition.op === "any_of" || condition.op === "none_of") {
      const selected = new Set(Array.isArray(condition.value) ? condition.value : []);
      return (
        <div className="flex flex-wrap gap-1.5">
          {(field.options ?? []).map((o) => (
            <label key={o.id} className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors", selected.has(o.id) ? "border-leaf bg-leaf/15 text-leaf" : "border-line text-muted hover:border-leaf/40")}>
              <input
                type="checkbox"
                className="sr-only"
                checked={selected.has(o.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(o.id);
                  else next.delete(o.id);
                  onChange([...next]);
                }}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    return (
      <Select aria-label="Value" value={typeof condition.value === "string" ? condition.value : ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {(field.options ?? []).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>
    );
  }

  if (NUMERIC_TYPES.has(field.type)) {
    return (
      <Input
        aria-label="Value"
        type="number"
        value={condition.value === undefined ? "" : String(condition.value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    );
  }

  if (TEMPORAL_TYPES.has(field.type)) {
    return <Input aria-label="Value" type={field.type === "date" ? "date" : "time"} value={typeof condition.value === "string" ? condition.value : ""} onChange={(e) => onChange(e.target.value)} />;
  }

  return <Input aria-label="Value" value={typeof condition.value === "string" ? condition.value : ""} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * Editor for one ConditionGroup. `fields` must already be limited to what this rule is allowed to
 * reference (see `earlierFields`/`fieldsThroughPage` in `ops.ts`) — this component doesn't re-check that,
 * it only ever offers what it's given, so the picker can never suggest something publishing would reject.
 */
export function ConditionGroupEditor({
  group,
  onChange,
  fields,
  emptyLabel = "Always shown",
  addLabel = "Add a condition",
}: {
  group: ConditionGroup | undefined;
  onChange: (g: ConditionGroup | undefined) => void;
  fields: Field[];
  emptyLabel?: string;
  addLabel?: string;
}) {
  const fieldsById = new Map(fields.map((f) => [f.id, f]));

  function addCondition() {
    const first = fields[0];
    if (!first) return;
    const condition: Condition = { fieldId: first.id, op: OPERATORS_FOR[first.type][0] };
    onChange({ mode: group?.mode ?? "all", conditions: [...(group?.conditions ?? []), condition] });
  }
  function updateCondition(i: number, patch: Partial<Condition>) {
    if (!group) return;
    onChange({ ...group, conditions: group.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }
  function removeCondition(i: number) {
    if (!group) return;
    const conditions = group.conditions.filter((_, idx) => idx !== i);
    onChange(conditions.length ? { ...group, conditions } : undefined);
  }

  if (fields.length === 0) return <p className="text-xs text-muted">No earlier questions to base a rule on yet.</p>;

  return (
    <div className="grid gap-2">
      {!group || group.conditions.length === 0 ? (
        <p className="text-xs italic text-muted">{emptyLabel}</p>
      ) : (
        <>
          {group.conditions.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted">Match</span>
              {(["all", "any"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onChange({ ...group, mode: m })}
                  className={cn("rounded-full border px-2 py-0.5 font-medium transition-colors", group.mode === m ? "border-leaf bg-leaf/15 text-leaf" : "border-line text-muted hover:border-leaf/40")}
                >
                  {m === "all" ? "ALL" : "ANY"}
                </button>
              ))}
              <span className="text-muted">of these:</span>
            </div>
          )}
          <ul className="grid gap-2">
            {group.conditions.map((c, i) => {
              const field = fieldsById.get(c.fieldId);
              const ops = field ? OPERATORS_FOR[field.type] : [];
              return (
                <li key={i} className="grid gap-1.5 rounded-lg border border-line bg-night/40 p-2 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <Select
                      aria-label="Question"
                      value={c.fieldId}
                      onChange={(e) => {
                        const nf = fieldsById.get(e.target.value);
                        updateCondition(i, { fieldId: e.target.value, op: nf ? OPERATORS_FOR[nf.type][0] : c.op, value: undefined });
                      }}
                    >
                      {fields.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                    <Select aria-label="Comparison" value={c.op} onChange={(e) => updateCondition(i, { op: e.target.value as Condition["op"], value: undefined })}>
                      {ops.map((op) => (
                        <option key={op} value={op}>
                          {OPERATOR_LABELS[op]}
                        </option>
                      ))}
                    </Select>
                    {(c.op !== "is_empty" && c.op !== "is_filled") && (
                      <div className="sm:col-span-2">
                        <ConditionValueInput field={field} condition={c} onChange={(value) => updateCondition(i, { value })} />
                      </div>
                    )}
                  </div>
                  <button type="button" aria-label="Remove condition" onClick={() => removeCondition(i)} className="justify-self-end rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={addCondition}>
        <Plus className="size-4" aria-hidden="true" />
        {addLabel}
      </Button>
    </div>
  );
}
