"use client";

import { ImagePicker } from "@/components/admin/image-picker";
import type { HomepageImageDTO } from "@/lib/data/homepage";
import { newSectionId } from "@/lib/homepage/sections/factories";
import { ABOUT_ACTIVITY_ICONS, type AboutActivity, type Section, type SectionOfType } from "@/lib/homepage/sections/schema";

const ICON_LABELS: Record<AboutActivity["icon"], string> = {
  book: "Book",
  code: "Code",
  users: "People",
  rocket: "Rocket",
  trophy: "Trophy",
  lightbulb: "Idea",
  branch: "Git branch",
  mic: "Microphone",
};

export function AboutForm({
  section,
  onUpdate,
  images,
  onImageResolved,
}: {
  section: SectionOfType<"about">;
  onUpdate: (patch: Partial<Section>) => void;
  images: Record<string, HomepageImageDTO>;
  onImageResolved: (id: string, image: HomepageImageDTO) => void;
}) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  const image = c.imageId ? images[c.imageId] : undefined;
  const patchActivity = (i: number, patch: Partial<AboutActivity>) => patchContent({ activities: c.activities.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
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
      <div className="grid gap-2">
        <p className="text-sm text-muted">What we do (up to 4)</p>
        {c.activities.map((a, i) => (
          <div key={a.id} className="grid gap-1.5 rounded-lg border border-line p-2">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-1.5">
              <select aria-label="Icon" value={a.icon} onChange={(e) => patchActivity(i, { icon: e.target.value as AboutActivity["icon"] })} className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm">
                {ABOUT_ACTIVITY_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {ICON_LABELS[icon]}
                  </option>
                ))}
              </select>
              <input aria-label="Title" value={a.title} maxLength={40} onChange={(e) => patchActivity(i, { title: e.target.value })} placeholder="Title" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
              <button type="button" aria-label="Remove" onClick={() => patchContent({ activities: c.activities.filter((_, j) => j !== i) })} className="rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
                ×
              </button>
            </div>
            <textarea aria-label="Description" value={a.description} maxLength={160} rows={2} onChange={(e) => patchActivity(i, { description: e.target.value })} placeholder="One line about it" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
          </div>
        ))}
        {c.activities.length < 4 && (
          <button
            type="button"
            onClick={() => patchContent({ activities: [...c.activities, { id: newSectionId(), icon: "code", title: "New activity", description: "" }] })}
            className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost"
          >
            + Add activity
          </button>
        )}
      </div>
      <div className="grid gap-1">
        <span className="text-sm text-muted">Image</span>
        <ImagePicker
          uploadId={c.imageId}
          url={image?.url ?? null}
          alt={image?.alt ?? ""}
          onChange={(uploadId, url, alt) => {
            onImageResolved(uploadId, { url, alt });
            patchContent({ imageId: uploadId });
          }}
        />
      </div>
    </div>
  );
}
