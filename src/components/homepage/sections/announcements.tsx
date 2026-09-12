// src/components/homepage/sections/announcements.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function AnnouncementsSection({ section }: { section: SectionOfType<"announcements"> }) {
  const rows = await db.announcement.findMany({
    where: { status: "PUBLISHED", showOnHomepage: true, publishAt: { lte: new Date() } },
    orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
    take: section.content.maxItems,
    select: { id: true, slug: true, title: true, summary: true, priority: true },
  });
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-6 font-display text-2xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid gap-3">
        {rows.map((a) => (
          <li key={a.id}>
            <Link href={`/announcements/${a.slug}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-leaf/30">
              <p className="font-medium">{a.title}</p>
              {a.summary && <p className="text-sm text-muted">{a.summary}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
