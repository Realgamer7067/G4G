import Link from "next/link";
import { EventCard } from "@/components/events/event-card";
import { FeaturedEvent } from "@/components/events/featured-event";
import { PageIntro } from "@/components/site/page-intro";
import { assertPageEnabled } from "@/lib/data/pages";
import { getPublicEvents } from "@/lib/data/events";
import { getSiteSettings } from "@/lib/data/site";
import { metadataForPage } from "@/lib/seo";
import { cn } from "@/lib/utils/cn";

const CHIP =
  "rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors duration-200 hover:text-frost aria-[current=page]:border-leaf/50 aria-[current=page]:bg-leaf/10 aria-[current=page]:text-frost";

export async function generateMetadata() {
  return metadataForPage("EVENTS", { title: "Events", description: "Workshops, hackathons, talks and meetups run by the chapter." });
}

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  await assertPageEnabled("EVENTS");
  const sp = await searchParams;
  const when = sp.when === "past" ? "past" : "upcoming";
  const category = typeof sp.category === "string" ? sp.category : "";
  const [events, { timezone }] = await Promise.all([getPublicEvents(), getSiteSettings()]);
  const now = new Date();

  const categories = [...new Map(events.filter((e) => e.category).map((e) => [e.category!.slug, e.category!])).values()];
  const inCategory = category ? events.filter((e) => e.category?.slug === category) : events;
  const list =
    when === "upcoming"
      ? inCategory.filter((e) => new Date(e.endAt) >= now).sort((a, b) => a.startAt.localeCompare(b.startAt))
      : inCategory.filter((e) => new Date(e.endAt) < now);
  // The soonest upcoming event gets the large feature treatment, unless a filter narrows the list.
  const featured = when === "upcoming" && !category && list.length > 0 ? list[0] : null;
  const grid = featured ? list.slice(1) : list;
  const link = (params: { when?: string; category?: string }) => {
    const q = new URLSearchParams();
    const w = params.when ?? when;
    const c = params.category ?? category;
    if (w === "past") q.set("when", "past");
    if (c) q.set("category", c);
    const s = q.toString();
    return s ? `/events?${s}` : "/events";
  };

  const activeCategory = categories.find((c) => c.slug === category);
  return (
    <div className="pb-24">
      <PageIntro
        eyebrow="Events"
        title={when === "upcoming" ? "What’s coming up" : "What we’ve run"}
        lead="Workshops, hackathons, talks and meetups. Pick one, show up, build something."
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <nav aria-label="Upcoming or past" className="inline-flex rounded-full border border-line bg-surface p-1">
            {(["upcoming", "past"] as const).map((w) => (
              <Link
                key={w}
                href={link({ when: w })}
                aria-current={w === when ? "page" : undefined}
                className={cn("rounded-full px-4 py-1.5 text-sm text-muted transition-colors duration-200 hover:text-frost", w === when && "bg-leaf font-semibold text-night hover:text-night")}
              >
                {w === "upcoming" ? "Upcoming" : "Past"}
              </Link>
            ))}
          </nav>
          {categories.length > 1 && (
            <nav aria-label="Categories" className="flex flex-wrap gap-2">
              <Link href={link({ category: "" })} aria-current={!category ? "page" : undefined} className={CHIP}>
                All
              </Link>
              {categories.map((c) => (
                <Link key={c.slug} href={link({ category: c.slug })} aria-current={category === c.slug ? "page" : undefined} className={CHIP}>
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <p className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted" role="status">
          <span>
            {list.length} {when === "upcoming" ? "upcoming" : "past"} event{list.length === 1 ? "" : "s"}
            {activeCategory ? ` in ${activeCategory.name}` : ""}
          </span>
          {(category || when === "past") && (
            <Link href="/events" className="link-sweep font-semibold text-leaf">
              Clear filters
            </Link>
          )}
        </p>
      </PageIntro>

      {featured && (
        <section aria-label="Next event" className="container-x pb-10">
          <FeaturedEvent event={featured} timezone={timezone} now={now} priority reveal={false} />
        </section>
      )}

      <section aria-label={when === "upcoming" ? "Upcoming events" : "Past events"} className="container-x">
        {list.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-line px-6 py-16 text-center">
            <p className="font-display text-2xl font-bold">{when === "upcoming" ? "Nothing scheduled right now" : "No past events yet"}</p>
            <p className="max-w-md text-muted">
              {when === "upcoming" ? "New events are announced here first. Check back soon." : "Once events wrap up, they’ll be listed here."}
            </p>
            {when === "upcoming" && (
              <Link href={link({ when: "past" })} className="text-sm text-leaf hover:underline">
                See past events
              </Link>
            )}
          </div>
        ) : grid.length === 0 ? null : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((e, i) => (
              <li key={e.id}>
                <EventCard event={e} timezone={timezone} now={now} priority={!featured && i < 3} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
