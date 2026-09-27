import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { PageIntro } from "@/components/site/page-intro";
import { Spotlight } from "@/components/site/spotlight";
import { getPublicAlbums, type GalleryAlbumCardDTO } from "@/lib/data/gallery";
import { assertPageEnabled } from "@/lib/data/pages";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("GALLERY", { title: "Gallery", description: "Photos from our workshops, hackathons and meetups." });
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", timeZone: "UTC" });
const meta = (a: GalleryAlbumCardDTO) => `${a.imageCount} photo${a.imageCount === 1 ? "" : "s"}${a.date ? ` · ${monthYear(a.date)}` : ""}`;

export default async function GalleryPage() {
  const page = await assertPageEnabled("GALLERY");
  const albums = await getPublicAlbums();
  // The most recent dated album leads; the rest keep the admin's order.
  const featured = albums.length > 1 ? albums.filter((a) => a.date && a.cover).sort((a, b) => b.date!.localeCompare(a.date!))[0] : undefined;
  const rest = featured ? albums.filter((a) => a.id !== featured.id) : albums;
  const photos = albums.reduce((n, a) => n + a.imageCount, 0);

  return (
    <div className="pb-24">
      <PageIntro
        eyebrow={page.navLabel}
        title="Moments from the chapter"
        lead="Photos from our workshops, hackathons and meetups, album by album."
        aside={
          albums.length > 0 && (
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
              {albums.length} album{albums.length === 1 ? "" : "s"} · {photos} photos
            </p>
          )
        }
      />

      <div className="container-x grid gap-6">
        {albums.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Photos from our events will be posted here soon.</p>
        ) : (
          <>
            {featured && (
              <Link href={`/gallery/${featured.slug}`} className="group relative block overflow-hidden rounded-[28px] border border-line bg-night">
                <Picture
                  image={featured.cover!}
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  priority
                  alt=""
                  imgClassName="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transform-none sm:aspect-[21/9]"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgb(8_18_13/0.9),rgb(8_18_13/0.1)_55%,transparent)]" />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-6 sm:p-10">
                  <div className="grid gap-2">
                    <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">Latest album</p>
                    <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] sm:text-5xl">{featured.title}</h2>
                    <p className="text-sm text-frost/75">{meta(featured)}</p>
                  </div>
                  <span className="grid size-12 place-items-center rounded-full bg-leaf text-night transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true">
                    <ArrowUpRight className="size-5" />
                  </span>
                </div>
              </Link>
            )}
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a, i) => (
                <li key={a.id}>
                  <Spotlight className="reveal h-full rounded-[24px]">
                    <Link href={`/gallery/${a.slug}`} className="group grid h-full content-start gap-4 rounded-[24px] border border-line bg-surface p-3 transition-colors duration-200 hover:border-leaf/30">
                      <div className="aspect-[4/3] overflow-hidden rounded-[18px] bg-raised">
                        {a.cover ? (
                          <Picture
                            image={a.cover}
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            priority={!featured && i < 3}
                            alt=""
                            imgClassName="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
                          />
                        ) : (
                          <span className="grid size-full place-items-center text-sm text-muted">No photos yet</span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-3 px-2 pb-2">
                        <div className="grid gap-1">
                          <h2 className="font-display text-lg font-bold tracking-tight">{a.title}</h2>
                          <p className="text-sm text-muted">{meta(a)}</p>
                        </div>
                        <ArrowUpRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-leaf" />
                      </div>
                    </Link>
                  </Spotlight>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
