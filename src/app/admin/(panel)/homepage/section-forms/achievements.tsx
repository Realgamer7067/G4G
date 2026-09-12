"use client";

import { newSectionId } from "@/lib/homepage/sections/factories";
import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AchievementsForm({ section, onUpdate }: { section: SectionOfType<"achievements">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      {c.items.map((item, i) => (
        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-1.5 rounded-lg border border-line p-2">
          <div className="grid gap-1.5">
            <input value={item.title} onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Title" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
            <input
              type="number"
              value={item.year}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, year: Number(e.target.value) } : x)) })}
              placeholder="Year"
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
            <textarea
              value={item.description}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })}
              placeholder="Description"
              rows={2}
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
            <input
              value={item.link ?? ""}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, link: e.target.value || undefined } : x)) })}
              placeholder="Link (optional)"
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
          </div>
          <button type="button" onClick={() => patchContent({ items: c.items.filter((_, j) => j !== i) })} className="self-start rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
            ×
          </button>
        </div>
      ))}
      {c.items.length < 12 && (
        <button
          type="button"
          onClick={() => patchContent({ items: [...c.items, { id: newSectionId(), title: "New achievement", description: "", year: new Date().getFullYear(), imageId: null }] })}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost"
        >
          + Add achievement
        </button>
      )}
    </div>
  );
}
