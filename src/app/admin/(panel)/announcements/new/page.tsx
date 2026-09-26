import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { utcToZonedInput } from "@/lib/utils/timezone";
import { AnnouncementForm } from "../announcement-form";

export const metadata: Metadata = { title: "New announcement" };

export default async function NewAnnouncementPage() {
  await requirePagePermission("announcements.manage");
  const { timezone } = await loadSiteSettings();
  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/admin/announcements" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All announcements
      </Link>
      <PageHeader eyebrow="Announcements" title="New announcement" />
      <AnnouncementForm
        timezone={timezone}
        values={{
          id: null,
          title: "",
          slug: "",
          summary: "",
          content: "",
          publishAt: utcToZonedInput(new Date(), timezone),
          expiresAt: "",
          linkUrl: "",
          linkLabel: "",
          priority: "NORMAL",
          pinned: false,
          showOnHomepage: true,
          showAsBanner: false,
        }}
      />
    </div>
  );
}
