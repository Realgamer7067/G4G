import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { utcToZonedInput } from "@/lib/utils/timezone";
import { AnnouncementForm, DeleteAnnouncementForm } from "../announcement-form";
import { AnnouncementStatusBar } from "../status-bar";

export const metadata: Metadata = { title: "Edit announcement" };

export default async function EditAnnouncementPage({ params, searchParams }: PageProps<"/admin/announcements/[id]">) {
  await requirePagePermission("announcements.manage");
  const { id } = await params;
  const sp = await searchParams;
  const announcement = await db.announcement.findUnique({ where: { id } });
  if (!announcement) notFound();
  const { timezone } = await loadSiteSettings();

  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/admin/announcements" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All announcements
      </Link>
      <header className="grid gap-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{announcement.title}</h1>
        <AnnouncementStatusBar id={announcement.id} status={announcement.status} publicUrl={announcement.status === "PUBLISHED" ? `/announcements/${announcement.slug}` : null} />
      </header>
      {sp.created && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Draft created. Publish it when it&apos;s ready.
        </p>
      )}
      <AnnouncementForm
        timezone={timezone}
        values={{
          id: announcement.id,
          title: announcement.title,
          slug: announcement.slug,
          summary: announcement.summary,
          content: announcement.content,
          publishAt: utcToZonedInput(announcement.publishAt, timezone),
          expiresAt: announcement.expiresAt ? utcToZonedInput(announcement.expiresAt, timezone) : "",
          linkUrl: announcement.linkUrl ?? "",
          linkLabel: announcement.linkLabel ?? "",
          priority: announcement.priority,
          pinned: announcement.pinned,
          showOnHomepage: announcement.showOnHomepage,
          showAsBanner: announcement.showAsBanner,
        }}
      />
      <Panel title="Delete announcement">
        <DeleteAnnouncementForm id={announcement.id} />
      </Panel>
    </div>
  );
}
