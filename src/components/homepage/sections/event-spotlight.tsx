// src/components/homepage/sections/event-spotlight.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FeaturedEvent } from "@/components/events/featured-event";
import { Reveal } from "@/components/motion/reveal";
import { getPublicEvents, type EventCardDTO } from "@/lib/data/events";
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

      <FeaturedEvent event={event} timezone={timezone} now={now} showCountdown={c.showCountdown} />
    </section>
  );
}
