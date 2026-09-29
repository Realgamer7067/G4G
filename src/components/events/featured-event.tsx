import Link from "next/link";
import { ArrowRight, CalendarDays, Globe, MapPin } from "lucide-react";
import { Countdown } from "@/components/events/countdown";
import { StatusPill } from "@/components/events/status-pill";
import { Reveal } from "@/components/motion/reveal";
import { LinkButton } from "@/components/ui/link-button";
import { statsOf, statusInputOf, type EventCardDTO } from "@/lib/data/events";
import { formatEventWhen } from "@/lib/events/format";
import { deriveEventStatus } from "@/lib/events/status";
import { PosterImage } from "./poster-image";

/** The large 7/5 event feature used by the homepage spotlight and the top of /events. */
export function FeaturedEvent({
  event,
  timezone,
  now,
  showCountdown = true,
  priority = false,
  reveal = true,
}: {
  event: EventCardDTO;
  timezone: string;
  now: Date;
  showCountdown?: boolean;
  priority?: boolean;
  /** Off when the card is above the fold, so it paints without waiting for hydration. */
  reveal?: boolean;
}) {
  const upcoming = new Date(event.endAt) > now;
  const when = formatEventWhen(event.startAt, event.endAt, timezone);
  const status = deriveEventStatus(statusInputOf(event), statsOf(event, now), now);
  const place = event.mode === "ONLINE" ? "Online" : event.mode === "HYBRID" ? `${event.venue || "On campus"} + online` : event.venue;
  const Wrapper = reveal ? Reveal : "div";
  return (
    <Wrapper className="group grid overflow-hidden rounded-[28px] border border-line bg-surface lg:grid-cols-[7fr_5fr]">
      <Link href={`/events/${event.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-night lg:aspect-auto lg:min-h-[28rem]" tabIndex={-1} aria-hidden="true">
        {event.poster ? (
          <PosterImage
            image={event.poster}
            sizes="(min-width: 1024px) 720px, 100vw"
            priority={priority}
            className="absolute inset-0"
            imgClassName="transition-transform duration-[350ms] ease-out group-hover:scale-[1.035] motion-reduce:transform-none"
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
                {event.mode === "ONLINE" ? (
                  <Globe aria-hidden="true" className="size-4 shrink-0 text-leaf/80" />
                ) : (
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-leaf/80" />
                )}
                {place}
              </li>
            )}
          </ul>
        </div>
        <div className="grid gap-6">
          {upcoming && new Date(event.startAt) > now && showCountdown && <Countdown target={event.startAt} label="Starts in" />}
          <LinkButton href={`/events/${event.slug}`} size="lg" className="w-fit">
            {upcoming ? "See details" : "See what we did"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </LinkButton>
        </div>
      </div>
    </Wrapper>
  );
}
