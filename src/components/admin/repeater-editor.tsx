"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type RepeaterField = { key: string; label: string; placeholder?: string; type?: string; width?: string };

/** A list of small records (organizers, contacts, links…) submitted as JSON in one hidden input. */
export function RepeaterEditor({
  name,
  fields,
  initial,
  max,
  addLabel,
}: {
  name: string;
  fields: RepeaterField[];
  initial: Record<string, string>[];
  max: number;
  addLabel: string;
}) {
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, ""]));
  const [rows, setRows] = useState<Record<string, string>[]>(initial);
  const move = (index: number, by: -1 | 1) =>
    setRows((list) => {
      const next = [...list];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });
  const template = `${fields.map((f) => f.width ?? "1fr").join(" ")} auto`;

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-xl border border-line bg-night/40 p-2 sm:grid-cols-[var(--cols)] sm:items-center sm:border-0 sm:bg-transparent sm:p-0" style={{ "--cols": template } as React.CSSProperties}>
          {fields.map((f) => (
            <Input
              key={f.key}
              aria-label={`${f.label} ${index + 1}`}
              placeholder={f.placeholder ?? f.label}
              type={f.type ?? "text"}
              value={row[f.key] ?? ""}
              onChange={(e) => setRows((list) => list.map((r, i) => (i === index ? { ...r, [f.key]: e.target.value } : r)))}
            />
          ))}
          <div className="flex justify-end">
            <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Move down" disabled={index === rows.length - 1} onClick={() => move(index, 1)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Remove" onClick={() => setRows((list) => list.filter((_, i) => i !== index))} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {rows.length < max && (
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setRows((list) => [...list, blank()])}>
          <Plus className="size-4" aria-hidden="true" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
