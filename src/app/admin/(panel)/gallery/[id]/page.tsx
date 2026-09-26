import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatAlbumDate } from "@/lib/gallery/schema";
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { AlbumForm, BackToGallery, DeleteAlbumForm } from "../album-form";
import { BulkUpload } from "../bulk-upload";
import { ImageGrid } from "../image-grid";

export const metadata: Metadata = { title: "Edit album" };

export default async function EditAlbumPage({ params, searchParams }: PageProps<"/admin/gallery/[id]">) {
  const user = await requirePagePermission("gallery.manage");
  const { id } = await params;
  const sp = await searchParams;
  const [album, events] = await Promise.all([
    db.galleryAlbum.findUnique({
      where: { id },
      include: { _count: { select: { images: true } }, images: { orderBy: { order: "asc" }, include: { upload: { select: publicImageSelect } } } },
    }),
    db.event.findMany({ select: { id: true, title: true }, orderBy: { startAt: "desc" }, take: 200 }),
  ]);
  if (!album) notFound();
  const gridImages = album.images
    .map((gi) => {
      const image = toPublicImage(gi.upload);
      return image ? { id: gi.id, uploadId: gi.uploadId, url: imageUrl(image, 480), alt: image.alt, caption: gi.caption } : null;
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

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
      <Panel title="Add photos" description="Upload one or more photos to this album.">
        {can(user, "media.upload") ? <BulkUpload albumId={album.id} /> : <p className="text-sm text-muted">You need the media upload permission to add photos.</p>}
      </Panel>
      <Panel title={`Photos (${album._count.images})`}>
        {/* Keyed on the id list so a server refresh after an upload/delete remounts the grid with fresh data. */}
        <ImageGrid key={gridImages.map((i) => i.id).join(",")} albumId={album.id} coverId={album.coverId} images={gridImages} />
      </Panel>
      <Panel title="Delete album" description="Removes the album and every photo in it.">
        <DeleteAlbumForm id={album.id} imageCount={album._count.images} />
      </Panel>
    </div>
  );
}
