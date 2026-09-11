import Link from "next/link";
import { EventCard } from "@/components/events/event-card";
import { Rings } from "@/components/site/rings";
import { assertPageEnabled } from "@/lib/data/pages";
import { getPublicEvents } from "@/lib/data/events";
import { getSiteSettings } from "@/lib/data/site";
import { metadataForPage } from "@/lib/seo";
import { cn } from "@/lib/utils/cn";

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
  const link = (params: { when?: string; category?: string }) => {
    const q = new URLSearchParams();
    const w = params.when ?? when;
    const c = params.category ?? category;
    if (w === "past") q.set("when", "past");
    if (c) q.set("category", c);
    const s = q.toString();
    return s ? `/events?${s}` : "/events";
  };

  return (
    <div className="relative isolate">
      <Rings className="pointer-events-none absolute -right-60 -top-40 -z-10 size-[720px] opacity-40" />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-10 pt-14 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">Events</p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          {when === "upcoming" ? "What’s coming up" : "What we’ve run"}
        </h1>
        <p className="max-w-2xl text-lg text-muted">Workshops, hackathons, talks and meetups. Pick one, show up, build something.</p>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <nav aria-label="Upcoming or past" className="inline-flex rounded-full border border-line bg-surface p-1">
            {(["upcoming", "past"] as const).map((w) => (
              <Link
                key={w}
                href={link({ when: w })}
                aria-current={w === when ? "page" : undefined}
                className={cn("rounded-full px-4 py-1.5 text-sm text-muted transition-colors hover:text-frost", w === when && "bg-leaf font-semibold text-night hover:text-night")}
              >
                {w === "upcoming" ? "Upcoming" : "Past"}
              </Link>
            ))}
          </nav>
          {categories.length > 1 && (
            <nav aria-label="Categories" className="flex flex-wrap gap-2">
              <Link href={link({ category: "" })} aria-current={!category ? "page" : undefined} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:text-frost aria-[current=page]:border-leaf/50 aria-[current=page]:text-frost">
                All
              </Link>
              {categories.map((c) => (
                <Link key={c.slug} href={link({ category: c.slug })} aria-current={category === c.slug ? "page" : undefined} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:text-frost aria-[current=page]:border-leaf/50 aria-[current=page]:text-frost">
                  {c.name}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </section>

      <section aria-label={when === "upcoming" ? "Upcoming events" : "Past events"} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((e, i) => (
              <li key={e.id}>
                <EventCard event={e} timezone={timezone} now={now} priority={i < 3} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
