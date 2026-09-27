"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function MarqueeForm({ section, onUpdate }: { section: SectionOfType<"marquee">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted">Topics (1 to 12, scrolling in one row)</p>
      {c.items.map((item, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
          <input
            aria-label={`Topic ${i + 1}`}
            value={item}
            maxLength={40}
            onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? e.target.value : x)) })}
            className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
          />
          <button
            type="button"
            aria-label={`Remove ${item || "topic"}`}
            disabled={c.items.length <= 1}
            onClick={() => patchContent({ items: c.items.filter((_, j) => j !== i) })}
            className="rounded-lg border border-line px-2 text-sm text-muted hover:text-danger disabled:opacity-40"
          >
            ×
          </button>
        </div>
      ))}
      {c.items.length < 12 && (
        <button type="button" onClick={() => patchContent({ items: [...c.items, "New topic"] })} className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost">
          + Add topic
        </button>
      )}
    </div>
  );
}
