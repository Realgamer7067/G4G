// src/components/homepage/sections/event-spotlight.tsx
import Link from "next/link";
import { ArrowRight, CalendarDays, Globe, MapPin } from "lucide-react";
import { Countdown } from "@/components/events/countdown";
import { StatusPill } from "@/components/events/status-pill";
import { Picture } from "@/components/media/picture";
import { Reveal } from "@/components/motion/reveal";
import { LinkButton } from "@/components/ui/link-button";
import { getPublicEvents, statsOf, statusInputOf, type EventCardDTO } from "@/lib/data/events";
import { formatEventWhen } from "@/lib/events/format";
import { deriveEventStatus } from "@/lib/events/status";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

function pick(events: EventCardDTO[], c: SectionOfType<"event_spotlight">["content"], now: Date): { event: EventCardDTO; upcoming: boolean } | null {
  if (c.mode === "pinned") {
    const pinned = events.find((e) => e.id === c.eventId && e.lifecycle === "PUBLISHED");
    return pinned ? { event: pinned, upcoming: new Date(pinned.endAt) > now } : null;
  }
  const upcoming = events
    .filter((e) => e.lifecycle === "PUBLISHED" && new Date(e.startAt) > now)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];
  if (upcoming) return { event: upcoming, upcoming: true };
  // Nothing scheduled: show the most recent past event rather than an empty module.
  const past = events
    .filter((e) => e.lifecycle === "PUBLISHED" && new Date(e.endAt) <= now)
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())[0];
  return past ? { event: past, upcoming: false } : null;
}

export async function EventSpotlightSection({ section, now, timezone }: { section: SectionOfType<"event_spotlight">; now: Date; timezone: string }) {
  const c = section.content;
  const chosen = pick(await getPublicEvents(), c, now);
  if (!chosen) return null;
  const { event, upcoming } = chosen;
  const when = formatEventWhen(event.startAt, event.endAt, timezone);
  const status = deriveEventStatus(statusInputOf(event), statsOf(event, now), now);
  const place = event.mode === "ONLINE" ? "Online" : event.mode === "HYBRID" ? `${event.venue || "On campus"} + online` : event.venue;
  const heading = section.headingOverride || (upcoming ? "Don't miss the next one" : "From our latest event");

  return (
    <section id={section.anchorId} className="container-x py-24 lg:py-32">
      <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-5xl">{heading}</h2>
        <Link href="/events" className="group inline-flex items-center gap-2 text-sm font-semibold text-leaf">
          <span className="link-sweep">All events</span>
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </Reveal>

      <Reveal className="group grid overflow-hidden rounded-[28px] border border-line bg-surface lg:grid-cols-[7fr_5fr]">
        <Link href={`/events/${event.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-night lg:aspect-auto lg:min-h-[28rem]" tabIndex={-1} aria-hidden="true">
          {event.poster ? (
            <Picture
              image={event.poster}
              sizes="(min-width: 1024px) 720px, 100vw"
              alt=""
              imgClassName="absolute inset-0 size-full object-cover transition-transform duration-[350ms] ease-out group-hover:scale-[1.035] motion-reduce:transform-none"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgb(92_201_123/0.45),transparent_50%),radial-gradient(circle_at_15%_100%,rgb(47_141_70/0.5),transparent_55%)]" />
          )}
        </Link>
        <div className="grid content-between gap-8 p-7 sm:p-10">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={status} />
              {event.category && <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">{event.category.name}</span>}
            </div>
            <h3 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              <Link href={`/events/${event.slug}`} className="link-sweep">
                {event.title}
              </Link>
            </h3>
            {event.tagline && <p className="max-w-[50ch] text-muted">{event.tagline}</p>}
            <ul className="grid gap-2 text-sm text-muted">
              <li className="flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-leaf/80" />
                {when.full}
              </li>
              {place && (
                <li className="flex items-center gap-2">
                  {event.mode === "ONLINE" ? <Globe aria-hidden="true" className="size-4 shrink-0 text-leaf/80" /> : <MapPin aria-hidden="true" className="size-4 shrink-0 text-leaf/80" />}
                  {place}
                </li>
              )}
            </ul>
          </div>
          <div className="grid gap-6">
            {upcoming && c.showCountdown && <Countdown target={event.startAt} label="Starts in" />}
            <LinkButton href={`/events/${event.slug}`} size="lg" className="w-fit">
              {upcoming ? "See details" : "See what we did"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </LinkButton>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
