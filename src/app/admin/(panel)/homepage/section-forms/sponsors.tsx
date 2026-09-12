"use client";

import { SPONSOR_TIERS, type Section, type SectionOfType } from "@/lib/homepage/sections/schema";

const TIER_LABELS: Record<(typeof SPONSOR_TIERS)[number], string> = {
  TITLE: "Title",
  POWERED_BY: "Powered by",
  TECHNOLOGY_PARTNER: "Technology partner",
  COMMUNITY_PARTNER: "Community partner",
  PARTNER: "Partner",
};

export function SponsorsForm({ section, onUpdate }: { section: SectionOfType<"sponsors">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  function toggle(tier: (typeof SPONSOR_TIERS)[number]) {
    const next = c.tierFilter.includes(tier) ? c.tierFilter.filter((t) => t !== tier) : [...c.tierFilter, tier];
    onUpdate({ content: { tierFilter: next } } as Partial<Section>);
  }
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm text-muted">Show tiers (none selected = show all)</legend>
      {SPONSOR_TIERS.map((tier) => (
        <label key={tier} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.tierFilter.includes(tier)} onChange={() => toggle(tier)} className="accent-leaf" />
          {TIER_LABELS[tier]}
        </label>
      ))}
    </fieldset>
  );
}
