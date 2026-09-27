// src/components/homepage/sections/stats.tsx
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

async function computeAuto(source: "events_completed" | "team_members" | "gallery_photos", now: Date): Promise<number> {
  switch (source) {
    case "events_completed":
      // Archived events plus published ones that have already ended.
      return db.event.count({ where: { OR: [{ lifecycle: "ARCHIVED" }, { lifecycle: "PUBLISHED", endAt: { lt: now } }] } });
    case "team_members":
      return db.teamMember.count({ where: { term: { isCurrent: true, isPublished: true } } });
    case "gallery_photos":
      return db.galleryImage.count({ where: { album: { isPublished: true } } });
  }
}

const COLS = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4"];

export async function StatsSection({ section }: { section: SectionOfType<"stats"> }) {
  const c = section.content;
  if (c.items.length === 0) return null;
  const now = new Date();
  const values = await Promise.all(c.items.map((item) => (item.source === "manual" ? Promise.resolve(item.value ?? 0) : computeAuto(item.source, now))));
  return (
    <section id={section.anchorId} className="border-y border-line/70 bg-pine/50">
      <div className="container-x grid gap-10 py-20 lg:grid-cols-[0.8fr_2fr] lg:items-end">
        {section.headingOverride && (
          <Reveal>
            <h2 className="max-w-xs font-display text-3xl font-extrabold leading-tight tracking-[-0.02em]">{section.headingOverride}</h2>
          </Reveal>
        )}
        <dl className={`grid grid-cols-2 gap-x-6 gap-y-10 ${COLS[Math.min(c.items.length, 4)]} ${section.headingOverride ? "" : "lg:col-span-2"}`}>
          {c.items.map((item, i) => (
            <div key={item.id} className="grid gap-2 border-l border-line pl-5">
              <dd className="order-1 font-display text-5xl font-extrabold tabular-nums tracking-[-0.04em] text-frost sm:text-6xl">
                <CountUp value={values[i]} />
                {item.suffix && <span className="text-leaf">{item.suffix}</span>}
              </dd>
              <dt className="order-2 text-sm text-muted">{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
