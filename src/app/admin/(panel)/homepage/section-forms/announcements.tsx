"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AnnouncementsForm({ section, onUpdate }: { section: SectionOfType<"announcements">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">Max announcements to show</span>
      <input
        type="number"
        min={1}
        max={10}
        value={c.maxItems}
        onChange={(e) => {
          // Leave maxItems unchanged while the field is transiently empty or not-yet-a-number,
          // rather than snapping the controlled input to a clamped fallback (e.g. 1) mid-edit —
          // same guard shape as achievements.tsx's year field, applied here for input-handling
          // consistency even though this field's own fallback stays within the schema's bounds.
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) {
            onUpdate({ content: { maxItems: Math.min(10, Math.max(1, n)) } } as Partial<Section>);
          }
        }}
        className="w-24 rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm"
      />
      <span className="text-xs text-muted">Only announcements marked &quot;Show on homepage&quot; (set on the announcement itself, once Phase 5&apos;s announcements admin ships) are considered.</span>
    </label>
  );
}
