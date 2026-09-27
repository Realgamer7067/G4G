// src/components/homepage/sections/announcements.tsx
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { getHomepageAnnouncements } from "@/lib/data/announcements";
import { getSiteSettings } from "@/lib/data/site";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { formatInZone } from "@/lib/utils/timezone";

export async function AnnouncementsSection({ section }: { section: SectionOfType<"announcements"> }) {
  const [rows, site] = await Promise.all([getHomepageAnnouncements(section.content.maxItems), getSiteSettings()]);
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="container-x grid gap-10 py-24 lg:grid-cols-[0.8fr_2fr] lg:gap-16">
      <Reveal className="grid content-start gap-4">
        <h2 className="font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em]">{section.headingOverride || "Latest updates"}</h2>
        <Link href="/announcements" className="group inline-flex w-fit items-center gap-2 text-sm font-semibold text-leaf">
          <span className="link-sweep">All updates</span>
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </Reveal>
      <ul className="border-t border-line">
        {rows.map((a) => (
          <li key={a.id} className="border-b border-line">
            <Link href={`/announcements/${a.slug}`} className="group grid gap-2 py-6 sm:grid-cols-[8rem_1fr_auto] sm:items-baseline sm:gap-6">
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted">
                {formatInZone(a.publishAt, site.timezone, { day: "numeric", month: "short" })}
                {a.priority === "URGENT" && <span className="ml-2 rounded-full bg-amber/15 px-2 py-0.5 text-[10px] text-amber">Urgent</span>}
              </span>
              <span className="grid gap-1">
                <span className="font-display text-xl font-bold tracking-tight transition-colors duration-150 group-hover:text-leaf">{a.title}</span>
                {a.summary && <span className="line-clamp-1 text-sm text-muted">{a.summary}</span>}
              </span>
              <ArrowUpRight aria-hidden="true" className="hidden size-5 text-muted transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-[3px] group-hover:text-leaf sm:block" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
