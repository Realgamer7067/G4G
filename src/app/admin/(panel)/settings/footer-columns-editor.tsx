"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FooterSettings } from "@/lib/settings/schema";

type Column = FooterSettings["columns"][number];

/** Footer link columns (max 4 × 8 links), submitted as JSON in `footer.columns`. */
export function FooterColumnsEditor({ initial }: { initial: Column[] }) {
  const [columns, setColumns] = useState<Column[]>(initial);
  const patchColumn = (ci: number, patch: Partial<Column>) =>
    setColumns((cols) => cols.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const patchLink = (ci: number, li: number, patch: Partial<Column["links"][number]>) =>
    patchColumn(ci, { links: columns[ci].links.map((l, i) => (i === li ? { ...l, ...patch } : l)) });

  return (
    <div className="grid gap-3">
      <input type="hidden" name="footer.columns" value={JSON.stringify(columns)} />
      <div className="grid gap-3 md:grid-cols-2">
        {columns.map((col, ci) => (
          <fieldset key={ci} className="grid content-start gap-2 rounded-xl border border-line bg-night/50 p-3">
            <legend className="sr-only">Footer column {ci + 1}</legend>
            <div className="flex items-center gap-2">
              <Input aria-label={`Column ${ci + 1} title`} placeholder="Column title" value={col.title} maxLength={40} onChange={(e) => patchColumn(ci, { title: e.target.value })} />
              <button type="button" aria-label={`Remove column ${ci + 1}`} onClick={() => setColumns((cols) => cols.filter((_, i) => i !== ci))} className="rounded-md p-2 text-muted hover:bg-raised hover:text-danger">
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
            {col.links.map((link, li) => (
              <div key={li} className="grid grid-cols-[1fr_1.3fr_auto] gap-2">
                <Input aria-label={`Column ${ci + 1} link ${li + 1} label`} placeholder="Label" value={link.label} maxLength={40} onChange={(e) => patchLink(ci, li, { label: e.target.value })} />
                <Input aria-label={`Column ${ci + 1} link ${li + 1} address`} placeholder="/about or https://…" value={link.href} maxLength={500} onChange={(e) => patchLink(ci, li, { href: e.target.value })} />
                <button type="button" aria-label="Remove link" onClick={() => patchColumn(ci, { links: col.links.filter((_, i) => i !== li) })} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger">
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {col.links.length < 8 && (
              <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => patchColumn(ci, { links: [...col.links, { label: "", href: "" }] })}>
                <Plus className="size-4" aria-hidden="true" />
                Add link
              </Button>
            )}
          </fieldset>
        ))}
      </div>
      {columns.length < 4 && (
        <Button type="button" variant="secondary" size="sm" className="justify-self-start" onClick={() => setColumns((cols) => [...cols, { title: "", links: [] }])}>
          <Plus className="size-4" aria-hidden="true" />
          Add column
        </Button>
      )}
    </div>
  );
}
