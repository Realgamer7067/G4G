"use client";

import { useState } from "react";
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  Circle,
  Clock,
  Copy,
  FileUp,
  Gauge,
  Hash,
  Heading,
  ImageIcon,
  Link2,
  Mail,
  Minus,
  Phone,
  Plus,
  Star,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_TYPES, type Block, type Field, type FieldType, type Page } from "@/lib/forms/engine/schema";
import { cn } from "@/lib/utils/cn";
import { ConditionGroupEditor } from "./condition-editor";
import type { ContentType } from "@/lib/forms/builder/factories";
import { describeGroup } from "@/lib/forms/builder/describe";

const FIELD_META: Record<FieldType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  short_text: { label: "Short text", icon: Type },
  long_text: { label: "Paragraph", icon: AlignLeft },
  email: { label: "Email", icon: Mail },
  phone: { label: "Phone", icon: Phone },
  number: { label: "Number", icon: Hash },
  dropdown: { label: "Dropdown", icon: ChevronDown },
  radio: { label: "Multiple choice", icon: Circle },
  checkboxes: { label: "Checkboxes", icon: CheckSquare },
  date: { label: "Date", icon: Calendar },
  time: { label: "Time", icon: Clock },
  url: { label: "Link", icon: Link2 },
  file: { label: "File upload", icon: FileUp },
  linear_scale: { label: "Linear scale", icon: Gauge },
  rating: { label: "Rating", icon: Star },
  yes_no: { label: "Yes / No", icon: CheckSquare },
};

const CONTENT_META: Record<ContentType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  heading: { label: "Heading", icon: Heading },
  text: { label: "Text block", icon: AlignLeft },
  image: { label: "Image", icon: ImageIcon },
  divider: { label: "Divider", icon: Minus },
  callout: { label: "Callout", icon: Type },
};

function blockSummary(block: Block): string | null {
  if (block.kind === "content") return block.text ? block.text.slice(0, 80) : null;
  const opts = block.options?.length;
  return opts ? `${opts} option${opts === 1 ? "" : "s"}` : null;
}

function BlockRow({
  block,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
  isFirst,
  isLast,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const meta = block.kind === "field" ? FIELD_META[block.type] : CONTENT_META[block.type];
  const Icon = meta.icon;
  const summary = blockSummary(block);
  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3 transition-colors",
        selected ? "border-leaf/60 bg-leaf/5" : "border-line bg-night/30 hover:border-leaf/30",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted" />
      <div className="grid min-w-0 gap-0.5">
        <span className="truncate text-sm font-medium">
          {block.kind === "field" ? block.label || "Untitled question" : meta.label}
          {block.kind === "field" && block.required && <span className="ml-1 text-leaf">*</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate text-xs text-muted">
          <span>{meta.label}</span>
          {summary && <span className="truncate">· {summary}</span>}
          {block.visibleWhen && <span className="truncate text-amber">· conditional</span>}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Move up" disabled={isFirst} onClick={() => onMove(-1)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
          ↑
        </button>
        <button type="button" aria-label="Move down" disabled={isLast} onClick={() => onMove(1)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
          ↓
        </button>
        <button type="button" aria-label="Duplicate" onClick={onDuplicate} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost">
          <Copy className="size-4" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Delete" onClick={onRemove} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger">
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function AddBlockPalette({ onAddField, onAddContent, onCancel }: { onAddField: (t: FieldType) => void; onAddContent: (t: ContentType) => void; onCancel: () => void }) {
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-night/40 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Questions</span>
        <button type="button" aria-label="Close" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-raised hover:text-frost">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {FIELD_TYPES.map((t) => {
          const Icon = FIELD_META[t].icon;
          return (
            <button key={t} type="button" onClick={() => onAddField(t)} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-xs hover:border-leaf/40 hover:bg-leaf/5">
              <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted" /> {FIELD_META[t].label}
            </button>
          );
        })}
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Content</span>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {(Object.keys(CONTENT_META) as ContentType[]).map((t) => {
          const Icon = CONTENT_META[t].icon;
          return (
            <button key={t} type="button" onClick={() => onAddContent(t)} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-xs hover:border-leaf/40 hover:bg-leaf/5">
              <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted" /> {CONTENT_META[t].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BranchRow({
  index,
  when,
  goTo,
  fields,
  fieldsById,
  laterPages,
  onChangeWhen,
  onChangeGoTo,
  onRemove,
}: {
  index: number;
  when: Page["branches"][number]["when"];
  goTo: string;
  fields: Field[];
  fieldsById: ReadonlyMap<string, Field>;
  laterPages: Page[];
  onChangeWhen: (w: Page["branches"][number]["when"] | undefined) => void;
  onChangeGoTo: (goTo: string) => void;
  onRemove: () => void;
}) {
  return (
    <li className="grid gap-2 rounded-lg border border-line bg-night/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Rule {index + 1}</span>
        <span className="truncate text-right text-xs text-muted">{describeGroup(when, fieldsById)}</span>
        <button type="button" aria-label="Remove rule" onClick={onRemove} className="shrink-0 rounded-md p-1 text-muted hover:bg-raised hover:text-danger">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <ConditionGroupEditor group={when} onChange={(g) => onChangeWhen(g)} fields={fields} emptyLabel="Add a condition below" addLabel="Add condition" />
      {when && when.conditions.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">then jump to</span>
          <Select aria-label="Jump to page" value={goTo} onChange={(e) => onChangeGoTo(e.target.value)} className="h-9 w-auto">
            <option value="submit">Submit the form</option>
            {laterPages.map((p, i) => (
              <option key={p.id} value={p.id}>
                {p.title || `Part ${i + 1}`}
              </option>
            ))}
          </Select>
        </div>
      )}
    </li>
  );
}

export function BlockCanvas({
  page,
  pageIndex,
  selectedBlockId,
  onSelectBlock,
  onUpdatePage,
  onAddField,
  onAddContent,
  onMoveBlock,
  onDuplicateBlock,
  onRemoveBlock,
  onAddBranch,
  onUpdateBranch,
  onRemoveBranch,
  fieldsById,
  fieldsThroughPage,
  laterPages,
}: {
  page: Page;
  pageIndex: number;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdatePage: (patch: Partial<Pick<Page, "title" | "description" | "defaultNext">>) => void;
  onAddField: (type: FieldType) => void;
  onAddContent: (type: ContentType) => void;
  onMoveBlock: (blockId: string, dir: -1 | 1) => void;
  onDuplicateBlock: (blockId: string) => void;
  onRemoveBlock: (blockId: string) => void;
  onAddBranch: (goTo: string) => void;
  onUpdateBranch: (branchId: string, patch: Partial<Page["branches"][number]>) => void;
  onRemoveBranch: (branchId: string) => void;
  fieldsById: ReadonlyMap<string, Field>;
  fieldsThroughPage: Field[];
  laterPages: Page[];
}) {
  const [showPalette, setShowPalette] = useState(false);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Part {pageIndex + 1}</span>
        <Input aria-label="Page title" value={page.title} onChange={(e) => onUpdatePage({ title: e.target.value })} placeholder={`Part ${pageIndex + 1}`} className="h-11 text-lg font-semibold" />
        <Textarea aria-label="Page description" value={page.description ?? ""} onChange={(e) => onUpdatePage({ description: e.target.value })} placeholder="Optional description shown under the title" rows={2} />
      </div>

      <ul className="grid gap-2">
        {page.blocks.map((block, i) => (
          <BlockRow
            key={block.id}
            block={block}
            selected={block.id === selectedBlockId}
            onSelect={() => onSelectBlock(block.id === selectedBlockId ? null : block.id)}
            onMove={(dir) => onMoveBlock(block.id, dir)}
            onDuplicate={() => onDuplicateBlock(block.id)}
            onRemove={() => onRemoveBlock(block.id)}
            isFirst={i === 0}
            isLast={i === page.blocks.length - 1}
          />
        ))}
        {page.blocks.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">This page has no questions yet.</p>}
      </ul>

      {showPalette ? (
        <AddBlockPalette
          onAddField={(t) => {
            onAddField(t);
            setShowPalette(false);
          }}
          onAddContent={(t) => {
            onAddContent(t);
            setShowPalette(false);
          }}
          onCancel={() => setShowPalette(false)}
        />
      ) : (
        <Button type="button" variant="secondary" size="sm" className="justify-self-start" onClick={() => setShowPalette(true)}>
          <Plus className="size-4" aria-hidden="true" /> Add question or content
        </Button>
      )}

      <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="grid gap-1">
          <h3 className="font-display text-sm font-semibold">After this page</h3>
          <p className="text-xs text-muted">Jump rules run top to bottom — the first one that matches wins. Otherwise it falls through to the default.</p>
        </div>
        {page.branches.length > 0 && (
          <ul className="grid gap-2">
            {page.branches.map((br, i) => (
              <BranchRow
                key={br.id}
                index={i}
                when={br.when}
                goTo={br.goTo}
                fields={fieldsThroughPage}
                fieldsById={fieldsById}
                laterPages={laterPages}
                onChangeWhen={(w) => onUpdateBranch(br.id, { when: w ?? { mode: "all", conditions: [] } })}
                onChangeGoTo={(goTo) => onUpdateBranch(br.id, { goTo })}
                onRemove={() => onRemoveBranch(br.id)}
              />
            ))}
          </ul>
        )}
        {laterPages.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => onAddBranch(laterPages[0]?.id ?? "submit")}>
            <Plus className="size-4" aria-hidden="true" /> Add jump rule
          </Button>
        ) : (
          page.branches.length === 0 && <p className="text-xs text-muted">No later pages to jump to yet.</p>
        )}
        <div className="flex items-center gap-2 border-t border-line pt-3 text-sm">
          <span className="text-muted">Otherwise, go to</span>
          <Select aria-label="Default next page" value={page.defaultNext} onChange={(e) => onUpdatePage({ defaultNext: e.target.value })} className="h-9 w-auto">
            <option value="next">The next page</option>
            <option value="submit">Submit the form</option>
            {laterPages.map((p, i) => (
              <option key={p.id} value={p.id}>
                {p.title || `Part ${i + 1}`}
              </option>
            ))}
          </Select>
        </div>
      </section>
    </div>
  );
}
