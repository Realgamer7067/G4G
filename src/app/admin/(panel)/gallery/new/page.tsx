import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { AlbumForm, BackToGallery } from "../album-form";

export const metadata: Metadata = { title: "New album" };

export default async function NewAlbumPage() {
  await requirePagePermission("gallery.manage");
  const events = await db.event.findMany({ select: { id: true, title: true }, orderBy: { startAt: "desc" }, take: 200 });
  return (
    <div className="grid max-w-3xl gap-8">
      <BackToGallery />
      <PageHeader eyebrow="Gallery" title="New album" />
      <AlbumForm values={{ id: null, title: "", description: "", date: "", eventId: null, isPublished: false }} events={events} />
    </div>
  );
}
