"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SECTION_META } from "@/lib/homepage/sections/meta";
import { SECTION_TYPES, type HomepageSections, type SectionType } from "@/lib/homepage/sections/schema";
import { cn } from "@/lib/utils/cn";

function Row({ id, label, enabled, selected, onSelect, onToggle, onRemove }: { id: string; label: string; enabled: boolean; selected: boolean; onSelect: () => void; onToggle: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5",
        selected ? "border-leaf/40 bg-leaf/5" : "border-line bg-surface",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`Reorder ${label}`} className="cursor-grab touch-none rounded p-1 text-muted hover:text-frost active:cursor-grabbing">
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onSelect} className={cn("min-w-0 flex-1 truncate text-left text-sm", !enabled && "text-muted line-through")}>
        {label}
      </button>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={enabled} onChange={onToggle} className="size-3.5 accent-leaf" />
        Show
      </label>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="shrink-0 rounded p-1 text-muted hover:text-danger">
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export function SectionList({
  sections,
  selectedId,
  onSelect,
  onReorder,
  onToggle,
  onRemove,
  onAdd,
}: {
  sections: HomepageSections;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (type: SectionType) => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from !== -1 && to !== -1) onReorder(from, to);
  }

  return (
    <div className="grid gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-2">
            {sections.map((s) => (
              <Row
                key={s.id}
                id={s.id}
                label={s.headingOverride || SECTION_META[s.type].label}
                enabled={s.enabled}
                selected={s.id === selectedId}
                onSelect={() => onSelect(s.id)}
                onToggle={() => onToggle(s.id)}
                onRemove={() => onRemove(s.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="relative">
        <Button type="button" variant="secondary" size="sm" onClick={() => setPaletteOpen((v) => !v)} className="w-full justify-center">
          <Plus className="size-4" aria-hidden="true" /> Add section
        </Button>
        {paletteOpen && (
          <ul className="absolute z-10 mt-1 grid w-full gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
            {SECTION_TYPES.map((type) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(type);
                    setPaletteOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-raised"
                >
                  <span className="font-medium">{SECTION_META[type].label}</span>
                  <span className="block text-xs text-muted">{SECTION_META[type].description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
