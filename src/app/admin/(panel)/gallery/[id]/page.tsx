import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatAlbumDate } from "@/lib/gallery/schema";
import { AlbumForm, BackToGallery, DeleteAlbumForm } from "../album-form";

export const metadata: Metadata = { title: "Edit album" };

export default async function EditAlbumPage({ params, searchParams }: PageProps<"/admin/gallery/[id]">) {
  await requirePagePermission("gallery.manage");
  const { id } = await params;
  const sp = await searchParams;
  const [album, events] = await Promise.all([
    db.galleryAlbum.findUnique({ where: { id }, include: { _count: { select: { images: true } } } }),
    db.event.findMany({ select: { id: true, title: true }, orderBy: { startAt: "desc" }, take: 200 }),
  ]);
  if (!album) notFound();

  return (
    <div className="grid max-w-3xl gap-8">
      <BackToGallery />
      <PageHeader eyebrow="Gallery" title={album.title} />
      {sp.created && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Album created. Add photos below.
        </p>
      )}
      <AlbumForm
        values={{
          id: album.id,
          title: album.title,
          description: album.description,
          date: formatAlbumDate(album.date),
          eventId: album.eventId,
          isPublished: album.isPublished,
        }}
        events={events}
      />
      <Panel title="Delete album" description="Removes the album and every photo in it.">
        <DeleteAlbumForm id={album.id} imageCount={album._count.images} />
      </Panel>
    </div>
  );
}
