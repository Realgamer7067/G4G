// src/components/homepage/sections/event-spotlight.tsx
import { EventCard } from "@/components/events/event-card";
import { Countdown } from "@/components/events/countdown";
import { getPublicEvents } from "@/lib/data/events";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function EventSpotlightSection({ section, now, timezone }: { section: SectionOfType<"event_spotlight">; now: Date; timezone: string }) {
  const c = section.content;
  const events = await getPublicEvents();
  const event =
    c.mode === "pinned"
      ? (events.find((e) => e.id === c.eventId && e.lifecycle === "PUBLISHED") ?? null)
      : events
          .filter((e) => e.lifecycle === "PUBLISHED" && new Date(e.startAt) > now)
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] ?? null;
  if (!event) return null;

  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {(section.headingOverride || section.subheadingOverride) && (
        <div className="mb-8 grid gap-2 text-center">
          {section.headingOverride && <h2 className="font-display text-3xl font-bold">{section.headingOverride}</h2>}
          {section.subheadingOverride && <p className="text-muted">{section.subheadingOverride}</p>}
        </div>
      )}
      <div className="mx-auto grid max-w-md gap-4">
        <EventCard event={event} timezone={timezone} now={now} />
        {c.showCountdown && <Countdown target={event.startAt} label="Starts in" />}
      </div>
    </section>
  );
}
