"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function CtaForm({ section, onUpdate }: { section: SectionOfType<"cta">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Heading</span>
        <input value={c.heading} onChange={(e) => patchContent({ heading: e.target.value })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Subheading</span>
        <textarea value={c.subheading ?? ""} onChange={(e) => patchContent({ subheading: e.target.value || undefined })} rows={2} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Background</span>
        <select value={c.backgroundVariant} onChange={(e) => patchContent({ backgroundVariant: e.target.value as typeof c.backgroundVariant })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
          <option value="outline">Outline</option>
        </select>
      </label>
      {c.ctas.map((cta, i) => (
        <div key={i} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-center">
          <input value={cta.label} onChange={(e) => patchContent({ ctas: c.ctas.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
          <input value={cta.href} onChange={(e) => patchContent({ ctas: c.ctas.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} placeholder="/link" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
          <select value={cta.style} onChange={(e) => patchContent({ ctas: c.ctas.map((x, j) => (j === i ? { ...x, style: e.target.value as typeof x.style } : x)) })} className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm">
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
          </select>
          {c.ctas.length > 1 && (
            <button type="button" onClick={() => patchContent({ ctas: c.ctas.filter((_, j) => j !== i) })} className="rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
              ×
            </button>
          )}
        </div>
      ))}
      {c.ctas.length < 2 && (
        <button type="button" onClick={() => patchContent({ ctas: [...c.ctas, { label: "Get involved", href: "/events", style: "primary" }] })} className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost">
          + Add button
        </button>
      )}
    </div>
  );
}
