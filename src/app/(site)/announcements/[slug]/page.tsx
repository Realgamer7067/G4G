import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Rings } from "@/components/site/rings";
import { ANNOUNCEMENT_PRIORITY_LABELS } from "@/lib/announcements/schema";
import { richTextToPlain, sanitizeRichText } from "@/lib/content/sanitize";
import { getPublicAnnouncement } from "@/lib/data/announcements";
import { assertPageEnabled } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { formatInZone } from "@/lib/utils/timezone";

export async function generateMetadata({ params }: PageProps<"/announcements/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const announcement = await getPublicAnnouncement(slug);
  if (!announcement) return {};
  const description = announcement.summary || richTextToPlain(announcement.content, 160);
  return {
    title: announcement.title,
    description,
    alternates: { canonical: `/announcements/${announcement.slug}` },
    openGraph: { type: "article", title: announcement.title, description, url: `/announcements/${announcement.slug}` },
  };
}

export default async function AnnouncementPage({ params }: PageProps<"/announcements/[slug]">) {
  await assertPageEnabled("ANNOUNCEMENTS");
  const { slug } = await params;
  const [announcement, site] = await Promise.all([getPublicAnnouncement(slug), getSiteSettings()]);
  if (!announcement) notFound();
  const content = sanitizeRichText(announcement.content);

  return (
    <article className="relative isolate">
      <Rings className="pointer-events-none absolute -left-72 -top-24 -z-10 size-[760px] opacity-35" />
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-14 sm:px-6 lg:px-8">
        <Link href="/announcements" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-frost">
          <ArrowLeft className="size-4" aria-hidden="true" /> All announcements
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-leaf">{ANNOUNCEMENT_PRIORITY_LABELS[announcement.priority]}</span>
          <span className="font-mono text-[11px] text-muted">{formatInZone(announcement.publishAt, site.timezone, { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
        <h1 className="font-display text-4xl font-extrabold leading-[0.98] tracking-tight sm:text-5xl">{announcement.title}</h1>
        {announcement.summary && <p className="text-lg text-muted">{announcement.summary}</p>}
        {content && <div className="rich-text max-w-[68ch]" dangerouslySetInnerHTML={{ __html: content }} />}
        {announcement.linkUrl && (
          <a
            href={announcement.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-fit items-center gap-2 rounded-full bg-leaf px-6 font-semibold text-night shadow-[0_14px_40px_-14px_rgb(92_201_123/0.8)] transition-transform hover:-translate-y-0.5"
          >
            {announcement.linkLabel || "Learn more"} <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}
