import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { AlbumList } from "./album-list";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryAdminPage({ searchParams }: PageProps<"/admin/gallery">) {
  await requirePagePermission("gallery.manage");
  const sp = await searchParams;
  const rows = await db.galleryAlbum.findMany({
    include: { cover: { select: publicImageSelect }, images: { orderBy: { order: "asc" }, take: 1, include: { upload: { select: publicImageSelect } } }, _count: { select: { images: true } } },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  const albums = rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    date: a.date ? a.date.toISOString() : null,
    cover: toPublicImage(a.cover) ?? toPublicImage(a.images[0]?.upload),
    imageCount: a._count.images,
    isPublished: a.isPublished,
  }));
  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader
        eyebrow="Content"
        title="Gallery"
        description="Photo albums shown on the public gallery. Drag to reorder."
        actions={
          <Link href="/admin/gallery/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            <Plus className="size-4" aria-hidden="true" /> New album
          </Link>
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Album deleted.
        </p>
      )}
      {albums.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">No albums yet.</p>
          <Link href="/admin/gallery/new" className="text-sm text-leaf hover:underline">
            Create the first one
          </Link>
        </div>
      ) : (
        <AlbumList albums={albums} />
      )}
    </div>
  );
}
