"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AboutForm({ section, onUpdate }: { section: SectionOfType<"about">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Heading</span>
        <input value={c.heading ?? ""} onChange={(e) => patchContent({ heading: e.target.value || undefined })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Body (one paragraph per line)</span>
        <textarea value={c.body} onChange={(e) => patchContent({ body: e.target.value })} rows={5} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <p className="text-xs text-muted">Image upload for this section reuses the same upload endpoint as other admin image fields — wire it up the same way `ImagePicker` does in `src/app/admin/(panel)/forms/[id]/build/inspector.tsx` if a photo is wanted here; `imageId` is already in the schema and ready to receive it.</p>
    </div>
  );
}
