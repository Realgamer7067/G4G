"use client";

import { useState } from "react";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { useFormAction } from "@/components/admin/form-state";
import { FormMessage } from "@/components/ui/form-message";
import { deleteResponsesAction } from "@/server/actions/forms";

export type ResponseRow = { id: string; submitted: string; email: string; event: string; cells: string[] };

export function ResponsesTable({ formId, headers, rows, showEvent, canDelete }: { formId: string; headers: string[]; rows: ResponseRow[]; showEvent: boolean; canDelete: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { state, pending, onSubmit } = useFormAction(deleteResponsesAction);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-3">
      {canDelete && selected.size > 0 && (
        <form
          onSubmit={(e) => {
            onSubmit(e);
            setSelected(new Set());
          }}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5"
        >
          <input type="hidden" name="formId" value={formId} />
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <span className="text-sm">{selected.size} selected</span>
          <ConfirmSubmit label="Delete" confirmLabel={`Delete ${selected.size} response${selected.size === 1 ? "" : "s"} permanently`} disabled={pending} />
        </form>
      )}
      {state?.ok && <FormMessage tone="success">{`Deleted ${state.data.deleted} response${state.data.deleted === 1 ? "" : "s"}.`}</FormMessage>}
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-pine text-xs text-muted">
            <tr>
              {canDelete && (
                <th scope="col" className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="size-4 accent-leaf"
                  />
                </th>
              )}
              <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
              <th scope="col" className="px-4 py-3 font-medium">Email</th>
              {showEvent && <th scope="col" className="px-4 py-3 font-medium">Event</th>}
              {headers.map((h) => (
                <th key={h} scope="col" className="max-w-48 px-4 py-3 font-medium">
                  <span className="line-clamp-1">{h}</span>
                </th>
              ))}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-leaf/5" : undefined}>
                {canDelete && (
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select response from ${r.submitted}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-leaf" />
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{r.submitted}</td>
                <td className="max-w-56 truncate px-4 py-3">{r.email || <span className="text-muted">—</span>}</td>
                {showEvent && <td className="max-w-40 truncate px-4 py-3 text-muted">{r.event || "—"}</td>}
                {r.cells.map((c, i) => (
                  <td key={i} className="max-w-48 truncate px-4 py-3">
                    {c || <span className="text-muted">—</span>}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/forms/${formId}/responses/${r.id}`} className="text-leaf hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
