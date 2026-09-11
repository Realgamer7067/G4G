import Link from "next/link";
import { ArrowUpRight, CalendarDays, Globe, MapPin } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { Spotlight } from "@/components/site/spotlight";
import { statsOf, statusInputOf, type EventCardDTO } from "@/lib/data/events";
import { dateBadge, formatEventWhen } from "@/lib/events/format";
import { SPONSOR_TIER_LABELS } from "@/lib/events/schema";
import { deriveEventStatus } from "@/lib/events/status";
import { cn } from "@/lib/utils/cn";
import { StatusPill } from "./status-pill";

export function EventCard({ event, timezone, now, priority = false }: { event: EventCardDTO; timezone: string; now: Date; priority?: boolean }) {
  const when = formatEventWhen(event.startAt, event.endAt, timezone);
  const badge = dateBadge(event.startAt, timezone);
  const status = deriveEventStatus(statusInputOf(event), statsOf(event), now);
  const place = event.mode === "ONLINE" ? "Online" : event.mode === "HYBRID" ? `${event.venue || "On campus"} + online` : event.venue;

  return (
    <Spotlight className="reveal group relative h-full rounded-3xl">
      <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-[transform,border-color,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:border-leaf/30 group-hover:shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)] motion-reduce:transform-none">
        <div className="relative aspect-video overflow-hidden bg-night">
          {event.poster ? (
            <Picture
              image={event.poster}
              sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
              alt=""
              priority={priority}
              imgClassName="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
            />
          ) : (
            <div aria-hidden="true" className="size-full bg-[radial-gradient(circle_at_80%_20%,rgb(92_201_123/0.45),transparent_45%),radial-gradient(circle_at_10%_110%,rgb(47_141_70/0.5),transparent_50%)]" />
          )}
          <div className="absolute left-3 top-3">
            <StatusPill status={status} className="bg-night/70" />
          </div>
          <div className="absolute right-3 top-3 grid min-w-14 justify-items-center rounded-2xl border border-white/10 bg-night/75 px-2.5 py-1.5 backdrop-blur" aria-hidden="true">
            <span className="font-display text-xl font-extrabold leading-none">{badge.day}</span>
            <span className="font-mono text-[10px] tracking-[0.12em] text-leaf">{badge.month}</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          {event.category && <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-leaf">{event.category.name}</p>}
          <h3 className="font-display text-xl font-bold leading-tight tracking-tight">
            <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              {event.title}
            </Link>
          </h3>
          {event.tagline && <p className="line-clamp-2 text-sm text-muted">{event.tagline}</p>}
          <ul className="mt-auto grid gap-1.5 pt-2 text-sm text-muted">
            <li className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-leaf/80" />
              <span className="truncate">{when.full}</span>
            </li>
            {place && (
              <li className="flex items-center gap-2">
                {event.mode === "ONLINE" ? <Globe aria-hidden="true" className="size-4 shrink-0 text-leaf/80" /> : <MapPin aria-hidden="true" className="size-4 shrink-0 text-leaf/80" />}
                <span className="truncate">{place}</span>
              </li>
            )}
          </ul>
          <div className={cn("flex items-center justify-between gap-3 border-t border-line pt-3", !event.headlineSponsor && "justify-end")}>
            {event.headlineSponsor && (
              <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
                <span className="shrink-0">{event.headlineSponsor.label || SPONSOR_TIER_LABELS[event.headlineSponsor.type]}</span>
                {event.headlineSponsor.logo ? (
                  <span className="grid h-7 place-items-center rounded-md bg-tile px-1.5">
                    <Picture image={event.headlineSponsor.logo} sizes="80px" alt={event.headlineSponsor.name} imgClassName="max-h-5 w-auto object-contain" />
                  </span>
                ) : (
                  <span className="truncate font-medium text-frost">{event.headlineSponsor.name}</span>
                )}
              </span>
            )}
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-leaf" aria-hidden="true">
              Details <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </article>
    </Spotlight>
  );
}
