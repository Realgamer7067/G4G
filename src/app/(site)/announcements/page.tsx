import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Rings } from "@/components/site/rings";
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
    <div className="relative isolate">
      <Rings className="pointer-events-none absolute -right-60 -top-40 -z-10 size-[720px] opacity-40" />
      <section className="mx-auto grid max-w-4xl gap-5 px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">Updates from the chapter</h1>
        <p className="max-w-2xl text-lg text-muted">Deadlines, results and news, newest first.</p>
      </section>

      <section aria-label="Announcements" className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        {rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Nothing posted yet. Check back soon.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((a) => (
              <li key={a.id}>
                <Link href={`/announcements/${a.slug}`} className="reveal grid gap-2 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-leaf/30">
                  <span className="flex flex-wrap items-center gap-2">
                    {a.pinned && <span className="rounded-full border border-leaf/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-leaf">Pinned</span>}
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{ANNOUNCEMENT_PRIORITY_LABELS[a.priority]}</span>
                    <span className="font-mono text-[11px] text-muted">{formatInZone(a.publishAt, site.timezone, { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-xl font-bold">{a.title}</span>
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  </span>
                  {a.summary && <span className="text-sm text-muted">{a.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
