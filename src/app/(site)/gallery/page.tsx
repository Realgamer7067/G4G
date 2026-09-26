import Link from "next/link";
import { Picture } from "@/components/media/picture";
import { Rings } from "@/components/site/rings";
import { Spotlight } from "@/components/site/spotlight";
import { getPublicAlbums } from "@/lib/data/gallery";
import { assertPageEnabled } from "@/lib/data/pages";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("GALLERY", { title: "Gallery", description: "Photos from our workshops, hackathons and meetups." });
}

export default async function GalleryPage() {
  const page = await assertPageEnabled("GALLERY");
  const albums = await getPublicAlbums();

  return (
    <div className="relative isolate">
      <Rings className="pointer-events-none absolute -right-60 -top-40 -z-10 size-[720px] opacity-40" />
      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">Moments from the chapter</h1>
        <p className="max-w-2xl text-lg text-muted">Photos from our workshops, hackathons and meetups, album by album.</p>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {albums.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Photos from our events will be posted here soon.</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((a, i) => (
              <li key={a.id}>
                <Spotlight className="reveal h-full rounded-3xl">
                  <Link href={`/gallery/${a.slug}`} className="grid h-full content-start gap-3 rounded-3xl border border-line bg-surface p-4">
                    <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-tile">
                      {a.cover ? (
                        <Picture image={a.cover} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" priority={i < 3} alt="" imgClassName="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-sm text-night/60">No photos yet</span>
                      )}
                    </div>
                    <div className="grid gap-1 px-1 pb-2">
                      <h2 className="font-semibold">{a.title}</h2>
                      <p className="text-sm text-muted">
                        {a.imageCount} photo{a.imageCount === 1 ? "" : "s"}
                        {a.date ? ` · ${new Date(a.date).toLocaleDateString("en-IN", { year: "numeric", month: "short", timeZone: "UTC" })}` : ""}
                      </p>
                    </div>
                  </Link>
                </Spotlight>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
