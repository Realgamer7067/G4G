"use client";

import { newSectionId } from "@/lib/homepage/sections/factories";
import { STAT_SOURCES, type Section, type SectionOfType } from "@/lib/homepage/sections/schema";

const SOURCE_LABELS: Record<(typeof STAT_SOURCES)[number], string> = {
  manual: "Manual number",
  events_completed: "Events completed (auto)",
  team_members: "Current team size (auto)",
  gallery_photos: "Gallery photos (auto)",
};

export function StatsForm({ section, onUpdate }: { section: SectionOfType<"stats">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      {c.items.map((item, i) => (
        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-1.5 rounded-lg border border-line p-2">
          <div className="grid gap-1.5">
            <input
              value={item.label}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              placeholder="Label"
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
            <select
              value={item.source}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, source: e.target.value as (typeof STAT_SOURCES)[number] } : x)) })}
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            >
              {STAT_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
            {item.source === "manual" && (
              <input
                type="number"
                value={item.value ?? ""}
                onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, value: e.target.value ? Number(e.target.value) : null } : x)) })}
                placeholder="Value"
                className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
              />
            )}
            <input
              value={item.suffix ?? ""}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, suffix: e.target.value || undefined } : x)) })}
              placeholder="Suffix (e.g. +)"
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
          </div>
          <button type="button" onClick={() => patchContent({ items: c.items.filter((_, j) => j !== i) })} className="self-start rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
            ×
          </button>
        </div>
      ))}
      {c.items.length < 6 && (
        <button
          type="button"
          onClick={() => patchContent({ items: [...c.items, { id: newSectionId(), label: "New stat", value: 0, source: "manual" }] })}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost"
        >
          + Add stat
        </button>
      )}
    </div>
  );
}
