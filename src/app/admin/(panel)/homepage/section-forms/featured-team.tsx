"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function FeaturedTeamForm({ section, onUpdate }: { section: SectionOfType<"featured_team">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">Max members to show</span>
      <input
        type="number"
        min={1}
        max={12}
        value={c.maxItems}
        onChange={(e) => {
          // Same guard shape as achievements.tsx's year field: leave maxItems unchanged while
          // the field is transiently empty or not-yet-a-number, rather than snapping the
          // controlled input to a clamped fallback mid-edit.
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) {
            onUpdate({ content: { maxItems: Math.min(12, Math.max(1, n)) } } as Partial<Section>);
          }
        }}
        className="w-24 rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm"
      />
      <span className="text-xs text-muted">Shows members marked &quot;featured&quot; on the current team (set per-member once Phase 5&apos;s team admin ships).</span>
    </label>
  );
}
