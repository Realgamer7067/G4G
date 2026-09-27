import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";

export type GalleryImageDTO = { id: string; caption: string; image: PublicImage };

export type GalleryAlbumCardDTO = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string | null;
  cover: PublicImage | null;
  imageCount: number;
};

export type GalleryAlbumDetailDTO = GalleryAlbumCardDTO & { images: GalleryImageDTO[] };

function toImageDTO(row: { id: string; caption: string; upload: Parameters<typeof toPublicImage>[0] }): GalleryImageDTO | null {
  const image = toPublicImage(row.upload);
  return image ? { id: row.id, caption: row.caption, image } : null;
}

async function loadPublicAlbums(): Promise<GalleryAlbumCardDTO[]> {
  const rows = await db.galleryAlbum.findMany({
    where: { isPublished: true },
    include: { cover: { select: publicImageSelect }, images: { orderBy: { order: "asc" }, take: 1, include: { upload: { select: publicImageSelect } } }, _count: { select: { images: true } } },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    date: a.date ? a.date.toISOString() : null,
    cover: toPublicImage(a.cover) ?? toPublicImage(a.images[0]?.upload),
    imageCount: a._count.images,
  }));
}

export const getPublicAlbums = unstable_cache(loadPublicAlbums, ["public-gallery-albums"], { tags: [TAGS.gallery] });

async function loadPublicAlbum(slug: string): Promise<GalleryAlbumDetailDTO | null> {
  const row = await db.galleryAlbum.findFirst({
    where: { slug, isPublished: true },
    include: { cover: { select: publicImageSelect }, images: { orderBy: { order: "asc" }, include: { upload: { select: publicImageSelect } } }, _count: { select: { images: true } } },
  });
  if (!row) return null;
  const images = row.images.map(toImageDTO).filter((i): i is GalleryImageDTO => i !== null);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.date ? row.date.toISOString() : null,
    cover: toPublicImage(row.cover) ?? images[0]?.image ?? null,
    imageCount: row._count.images,
    images,
  };
}

export function getPublicAlbum(slug: string): Promise<GalleryAlbumDetailDTO | null> {
  return unstable_cache(() => loadPublicAlbum(slug), ["public-gallery-album", slug], { tags: [TAGS.gallery] })();
}

export type GalleryHighlightDTO = GalleryImageDTO & { albumSlug: string; albumTitle: string };

async function loadGalleryHighlights(mode: "latest" | "album", albumId: string | null, maxItems: number): Promise<GalleryHighlightDTO[]> {
  const rows = await db.galleryImage.findMany({
    where: mode === "album" && albumId ? { albumId, album: { isPublished: true } } : { album: { isPublished: true } },
    orderBy: { createdAt: "desc" },
    take: maxItems,
    include: { upload: { select: publicImageSelect }, album: { select: { slug: true, title: true } } },
  });
  return rows.flatMap((row) => {
    const dto = toImageDTO(row);
    return dto ? [{ ...dto, albumSlug: row.album.slug, albumTitle: row.album.title }] : [];
  });
}

export function getGalleryHighlights(mode: "latest" | "album", albumId: string | null, maxItems: number): Promise<GalleryHighlightDTO[]> {
  return unstable_cache(() => loadGalleryHighlights(mode, albumId, maxItems), ["gallery-highlights", mode, albumId ?? "", String(maxItems)], { tags: [TAGS.gallery] })();
}
