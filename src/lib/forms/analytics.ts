import type { AnswerValue, Field } from "./engine/schema";
import { zonedDay } from "../utils/timezone";

/** Count of dates per calendar day (site zone), oldest first, ending today, zero-filled. */
export function dailySeries(dates: Date[], days: number, timeZone: string, now: Date = new Date()): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const key = zonedDay(d, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const today = zonedDay(now, timeZone);
  const base = new Date(`${today}T00:00:00Z`);
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

/** How often each option was chosen, in option order. Works for dropdown, radio, checkboxes and yes/no. */
export function choiceBreakdown(field: Field, values: (AnswerValue | undefined)[]): { id: string; label: string; count: number }[] {
  const opts =
    field.type === "yes_no"
      ? [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ]
      : (field.options ?? []).map((o) => ({ id: o.id, label: o.label }));
  const counts = new Map(opts.map((o) => [o.id, 0]));
  for (const v of values) {
    const ids = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
    for (const id of new Set(ids)) if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return opts.map((o) => ({ ...o, count: counts.get(o.id) ?? 0 }));
}
