"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function GalleryHighlightsForm({ section, onUpdate }: { section: SectionOfType<"gallery_highlights">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Source</span>
        <select value={c.mode} onChange={(e) => patchContent({ mode: e.target.value as typeof c.mode })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
          <option value="latest">Latest photos across all albums</option>
          <option value="album">A specific album</option>
        </select>
      </label>
      {c.mode === "album" && (
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Album ID</span>
          <input value={c.albumId ?? ""} onChange={(e) => patchContent({ albumId: e.target.value || null })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
        </label>
      )}
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Max photos</span>
        <input
          type="number"
          min={1}
          max={24}
          value={c.maxItems}
          onChange={(e) => {
            // Same guard shape as achievements.tsx's year field: leave maxItems unchanged while
            // the field is transiently empty or not-yet-a-number, rather than snapping the
            // controlled input to a clamped fallback mid-edit.
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n)) {
              patchContent({ maxItems: Math.min(24, Math.max(1, n)) });
            }
          }}
          className="w-24 rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm"
        />
      </label>
    </div>
  );
}
