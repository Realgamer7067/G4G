import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lightbox } from "@/components/gallery/lightbox";
import { assertPageEnabled } from "@/lib/data/pages";
import { getPublicAlbum } from "@/lib/data/gallery";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/gallery/[album]">): Promise<Metadata> {
  const { album: slug } = await params;
  const album = await getPublicAlbum(slug);
  if (!album) return metadataForPage("GALLERY", { title: "Gallery", description: "Photos from our events." });
  return metadataForPage("GALLERY", { title: album.title, description: album.description || `${album.imageCount} photos from ${album.title}.` });
}

export default async function GalleryAlbumPage({ params }: PageProps<"/gallery/[album]">) {
  await assertPageEnabled("GALLERY");
  const { album: slug } = await params;
  const album = await getPublicAlbum(slug);
  if (!album) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <Link href="/gallery" className="text-sm text-leaf hover:underline">
        ← All albums
      </Link>
      <header className="mt-4 grid gap-3">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{album.title}</h1>
        {album.description && <p className="max-w-2xl text-lg text-muted">{album.description}</p>}
        <p className="text-sm text-muted">
          {album.imageCount} photo{album.imageCount === 1 ? "" : "s"}
          {album.date ? ` · ${new Date(album.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}` : ""}
        </p>
      </header>

      {album.images.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">No photos in this album yet.</p>
      ) : (
        <Lightbox images={album.images} albumTitle={album.title} />
      )}
    </div>
  );
}
