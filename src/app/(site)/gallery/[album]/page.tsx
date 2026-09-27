import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div className="container-x pb-24 pt-10">
      <Link href="/gallery" className="group inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-frost">
        <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" /> All albums
      </Link>
      <header className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
        <h1 className="hero-in-2 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-6xl">{album.title}</h1>
        <div className="hero-in-3 grid gap-3">
          {album.description && <p className="text-lg text-muted">{album.description}</p>}
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
            {album.imageCount} photo{album.imageCount === 1 ? "" : "s"}
            {album.date ? ` · ${new Date(album.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}` : ""}
          </p>
        </div>
      </header>

      {album.images.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">No photos in this album yet.</p>
      ) : (
        <Lightbox images={album.images} albumTitle={album.title} />
      )}
    </div>
  );
}
