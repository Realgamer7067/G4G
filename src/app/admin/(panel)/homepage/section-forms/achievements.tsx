"use client";

import { ImagePicker } from "@/components/admin/image-picker";
import type { HomepageImageDTO } from "@/lib/data/homepage";
import { newSectionId } from "@/lib/homepage/sections/factories";
import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AchievementsForm({
  section,
  onUpdate,
  images,
  onImageResolved,
}: {
  section: SectionOfType<"achievements">;
  onUpdate: (patch: Partial<Section>) => void;
  images: Record<string, HomepageImageDTO>;
  onImageResolved: (id: string, image: HomepageImageDTO) => void;
}) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      {c.items.map((item, i) => (
        <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 rounded-lg border border-line p-2">
          <div className="grid min-w-0 gap-1.5">
            <input value={item.title} onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Title" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
            <input
              type="number"
              value={item.year}
              onChange={(e) => {
                // Number("") is 0, which fails the schema's min(1990) server-side and wedges the
                // save-status pill on an error until a valid year is retyped. Leave the item's year
                // unchanged while the field is transiently empty or not-yet-a-number instead of
                // pushing an invalid value upstream.
                const n = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(n)) {
                  patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, year: n } : x)) });
                }
              }}
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
            <ImagePicker
              uploadId={item.imageId}
              url={item.imageId ? (images[item.imageId]?.url ?? null) : null}
              alt={item.imageId ? (images[item.imageId]?.alt ?? "") : ""}
              onChange={(uploadId, url, alt) => {
                onImageResolved(uploadId, { url, alt });
                patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, imageId: uploadId } : x)) });
              }}
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
