// src/components/homepage/sections/stats.tsx
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

async function computeAuto(source: "events_completed" | "team_members" | "gallery_photos"): Promise<number> {
  switch (source) {
    case "events_completed":
      return db.event.count({ where: { lifecycle: "ARCHIVED" } });
    case "team_members":
      return db.teamMember.count({ where: { term: { isCurrent: true } } });
    case "gallery_photos":
      return db.galleryImage.count({ where: { album: { isPublished: true } } });
  }
}

export async function StatsSection({ section }: { section: SectionOfType<"stats"> }) {
  const c = section.content;
  if (c.items.length === 0) return null;
  const values = await Promise.all(c.items.map((item) => (item.source === "manual" ? Promise.resolve(item.value ?? 0) : computeAuto(item.source))));
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {c.items.map((item, i) => (
          <div key={item.id} className="grid gap-1 rounded-2xl border border-line bg-surface p-6 text-center">
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="font-display text-4xl font-extrabold text-leaf">
              {values[i]}
              {item.suffix}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
