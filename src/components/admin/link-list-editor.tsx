"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type LinkItem = { label: string; href: string };

/** Editable list of label + link pairs, submitted as JSON in a hidden input. */
export function LinkListEditor({
  name,
  initial,
  max,
  hrefKey = "href",
  hrefPlaceholder = "/events or https://…",
  addLabel = "Add link",
}: {
  name: string;
  initial: Record<string, string>[];
  max: number;
  hrefKey?: "href" | "url";
  hrefPlaceholder?: string;
  addLabel?: string;
}) {
  const [items, setItems] = useState<LinkItem[]>(initial.map((i) => ({ label: i.label ?? "", href: i[hrefKey] ?? "" })));
  const update = (index: number, patch: Partial<LinkItem>) =>
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, by: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });

  return (
    <div className="grid gap-2">
      <input type="hidden" name={name} value={JSON.stringify(items.map((i) => ({ label: i.label, [hrefKey]: i.href })))} />
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
          <Input aria-label={`Link ${index + 1} label`} placeholder="Label" value={item.label} maxLength={40} onChange={(e) => update(index, { label: e.target.value })} />
          <Input aria-label={`Link ${index + 1} address`} placeholder={hrefPlaceholder} value={item.href} maxLength={500} onChange={(e) => update(index, { href: e.target.value })} />
          <div className="flex">
            <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Remove link" onClick={() => setItems((list) => list.filter((_, i) => i !== index))} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
      {items.length < max && (
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setItems((list) => [...list, { label: "", href: "" }])}>
          <Plus className="size-4" aria-hidden="true" />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
