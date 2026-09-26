"use client";

import { ImagePicker } from "@/components/admin/image-picker";
import type { HomepageImageDTO } from "@/lib/data/homepage";
import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

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
