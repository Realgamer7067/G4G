import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { ANNOUNCEMENT_PRIORITY_LABELS } from "@/lib/announcements/schema";
import { getVisibleAnnouncements } from "@/lib/data/announcements";
import { assertPageEnabled } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { metadataForPage } from "@/lib/seo";
import { formatInZone } from "@/lib/utils/timezone";

export async function generateMetadata() {
  return metadataForPage("ANNOUNCEMENTS", { title: "Announcements", description: "Updates, deadlines and news from the chapter." });
}

export default async function AnnouncementsPage() {
  const page = await assertPageEnabled("ANNOUNCEMENTS");
  const [rows, site] = await Promise.all([getVisibleAnnouncements(), getSiteSettings()]);

  return (
    <div className="pb-24">
      <PageIntro layout="narrow" eyebrow={page.navLabel} title="Updates from the chapter" lead="Deadlines, results and news, newest first." />

      <section aria-label="Announcements" className="container-x max-w-4xl">
        {rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Nothing posted yet. Check back soon.</p>
        ) : (
          <ul className="border-t border-line">
            {rows.map((a) => (
              <li key={a.id} className="border-b border-line">
                <Link href={`/announcements/${a.slug}`} className="reveal group grid gap-3 py-7 sm:grid-cols-[9rem_1fr_auto] sm:items-baseline sm:gap-6">
                  <span className="grid content-start gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
                      {formatInZone(a.publishAt, site.timezone, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {a.pinned && <span className="rounded-full border border-leaf/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-leaf">Pinned</span>}
                      {a.priority !== "NORMAL" && (
                        <span className={a.priority === "URGENT" ? "rounded-full bg-amber/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-amber" : "rounded-full border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted"}>
                          {ANNOUNCEMENT_PRIORITY_LABELS[a.priority]}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="grid gap-1.5">
                    <span className="font-display text-2xl font-bold tracking-tight transition-colors duration-150 group-hover:text-leaf">{a.title}</span>
                    {a.summary && <span className="text-muted">{a.summary}</span>}
                  </span>
                  <ArrowUpRight aria-hidden="true" className="hidden size-5 text-muted transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-[3px] group-hover:text-leaf sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
