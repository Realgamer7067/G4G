"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function SocialForm({ section, onUpdate }: { section: SectionOfType<"social">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">Style</span>
      <select value={c.style} onChange={(e) => onUpdate({ content: { style: e.target.value as typeof c.style } } as Partial<Section>)} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
        <option value="icons">Icons only</option>
        <option value="buttons">Labeled buttons</option>
      </select>
    </label>
  );
}
