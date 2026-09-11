"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import type { DefinitionIssue } from "@/lib/forms/engine/validate-definition";
import type { Page } from "@/lib/forms/engine/schema";
import { cn } from "@/lib/utils/cn";

export function PagesRail({
  pages,
  selectedPageId,
  issues,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onMove,
}: {
  pages: Page[];
  selectedPageId: string;
  issues: DefinitionIssue[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const issueCount = (pageIndex: number) => issues.filter((i) => i.path === `pages.${pageIndex}` || i.path.startsWith(`pages.${pageIndex}.`)).length;

  return (
    <nav aria-label="Pages" className="grid content-start gap-2 rounded-2xl border border-line bg-surface p-3">
      <span className="px-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Pages</span>
      <ul className="grid gap-1.5">
        {pages.map((p, i) => {
          const count = issueCount(i);
          const selected = p.id === selectedPageId;
          return (
            <li key={p.id} className="group">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p.id);
                  }
                }}
                className={cn("grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition-colors", selected ? "border-leaf/60 bg-leaf/10" : "border-transparent hover:bg-raised")}
              >
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", selected ? "bg-leaf text-night" : "bg-raised text-muted")}>{i + 1}</span>
                <span className="min-w-0 truncate">{p.title || `Part ${i + 1}`}</span>
                {count > 0 && <span className="shrink-0 rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger">{count}</span>}
              </div>
              <div className="ml-8 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 has-[:focus-visible]:opacity-100">
                <button type="button" aria-label="Move page up" disabled={i === 0} onClick={() => onMove(p.id, -1)} className="rounded-md p-1 text-xs text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
                  ↑
                </button>
                <button type="button" aria-label="Move page down" disabled={i === pages.length - 1} onClick={() => onMove(p.id, 1)} className="rounded-md p-1 text-xs text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
                  ↓
                </button>
                <button type="button" aria-label="Duplicate page" onClick={() => onDuplicate(p.id)} className="rounded-md p-1 text-muted hover:bg-raised hover:text-frost">
                  <Copy className="size-3.5" aria-hidden="true" />
                </button>
                <button type="button" aria-label="Delete page" disabled={pages.length <= 1} onClick={() => onRemove(p.id)} className="rounded-md p-1 text-muted hover:bg-raised hover:text-danger disabled:opacity-30">
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onAdd} className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-2.5 py-2 text-sm text-muted hover:border-leaf/40 hover:text-frost">
        <Plus className="size-4" aria-hidden="true" /> Add page
      </button>
    </nav>
  );
}
