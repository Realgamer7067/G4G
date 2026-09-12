"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { HomepageHistoryEntry } from "@/lib/data/homepage";

export function HistoryPanel({
  history,
  onRestore,
  restoringId,
  disabled,
}: {
  history: HomepageHistoryEntry[];
  onRestore: (historyId: string) => void;
  restoringId: string | null;
  disabled: boolean;
}) {
  const [armedId, setArmedId] = useState<string | null>(null);

  if (history.length === 0) {
    return <p className="text-sm text-muted">No published revisions yet.</p>;
  }

  return (
    <ul className="grid gap-2">
      {history.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
          <div className="grid gap-0.5">
            <span className={entry.status === "PUBLISHED" ? "font-semibold text-leaf" : "text-muted"}>{entry.status === "PUBLISHED" ? "Live" : "Superseded"}</span>
            <span className="text-xs text-muted">
              {entry.publishedAt ? new Date(entry.publishedAt).toLocaleString() : "—"}
              {entry.publishedByName ? ` · ${entry.publishedByName}` : ""}
            </span>
          </div>
          {armedId === entry.id ? (
            <span className="inline-flex items-center gap-2">
              <Button type="button" variant="danger" size="sm" disabled={disabled} onClick={() => onRestore(entry.id)} autoFocus>
                {restoringId === entry.id ? "Restoring…" : "Confirm restore"}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setArmedId(null)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => setArmedId(entry.id)}>
              Restore to draft
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
