"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function EventSpotlightForm({ section, onUpdate }: { section: SectionOfType<"event_spotlight">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Which event</span>
        <select value={c.mode} onChange={(e) => patchContent({ mode: e.target.value as typeof c.mode })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
          <option value="next_upcoming">Next upcoming event (auto)</option>
          <option value="pinned">A specific event</option>
        </select>
      </label>
      {c.mode === "pinned" && (
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Event ID</span>
          <input value={c.eventId ?? ""} onChange={(e) => patchContent({ eventId: e.target.value || null })} placeholder="Paste the event's id" className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
          <span className="text-xs text-muted">Find the id in the event&apos;s admin URL, e.g. /admin/events/&lt;id&gt;/edit. A picker can replace this once the events list exposes one.</span>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={c.showCountdown} onChange={(e) => patchContent({ showCountdown: e.target.checked })} className="accent-leaf" />
        Show countdown
      </label>
    </div>
  );
}
