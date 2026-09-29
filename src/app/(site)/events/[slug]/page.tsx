import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarDays, CalendarPlus, Clock, Globe, Mail, MapPin, Phone, Users } from "lucide-react";
import { Countdown } from "@/components/events/countdown";
import { ShareButtons } from "@/components/events/share-buttons";
import { PosterImage } from "@/components/events/poster-image";
import { StatusPill } from "@/components/events/status-pill";
import { Picture } from "@/components/media/picture";
import { JsonLd } from "@/components/seo/json-ld";
import { Magnetic } from "@/components/motion/magnetic";
import { LinkButton } from "@/components/ui/link-button";
import { sanitizeRichText, richTextToPlain } from "@/lib/content/sanitize";
import { assertPageEnabled } from "@/lib/data/pages";
import { getPublicEvent, statsOf, statusInputOf } from "@/lib/data/events";
import { getSiteSettings } from "@/lib/data/site";
import { formatEventWhen } from "@/lib/events/format";
import { MODE_LABELS, SPONSOR_TIERS, SPONSOR_TIER_LABELS } from "@/lib/events/schema";
import { REASON_COPY, deriveEventStatus, registrationState } from "@/lib/events/status";
import { ogImage } from "@/lib/media/public-image";
import { absoluteUrl } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) return {};
  const description = event.seoDescription || event.tagline || richTextToPlain(event.description, 160);
  const og = event.poster ? ogImage(event.poster) : null;
  return {
    title: event.seoTitle || event.title,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: { type: "website", title: event.title, description, url: `/events/${event.slug}`, images: og ? [{ ...og, alt: event.poster?.alt || event.title }] : undefined },
    twitter: { card: og ? "summary_large_image" : "summary", title: event.title, description },
  };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  await assertPageEnabled("EVENTS");
  const { slug } = await params;
  const [event, site] = await Promise.all([getPublicEvent(slug), getSiteSettings()]);
  if (!event) notFound();

  const now = new Date();
  const input = statusInputOf(event);
  const status = deriveEventStatus(input, statsOf(event, now), now);
  const registration = registrationState(input, statsOf(event, now), now);
  const registerHref =
    event.registrationMode === "FORM" ? `/events/${event.slug}/register` : event.registrationMode === "EXTERNAL" ? event.externalRegistrationUrl : null;
  const when = formatEventWhen(event.startAt, event.endAt, site.timezone);
  const url = absoluteUrl(`/events/${event.slug}`);
  const countdownTarget = event.countdownTarget === "DEADLINE" && event.registrationDeadline ? event.registrationDeadline : event.startAt;
  const showCountdown = event.showCountdown && event.lifecycle === "PUBLISHED" && new Date(countdownTarget) > now;
  const description = sanitizeRichText(event.description);
  const sponsorGroups = SPONSOR_TIERS.map((tier) => ({ tier, items: event.sponsors.filter((s) => s.type === tier) })).filter((g) => g.items.length);
  const place = event.mode === "ONLINE" ? "Online" : event.venue || "Venue to be announced";

  return (
    <article className="relative isolate">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: event.title,
          description: event.seoDescription || event.tagline || richTextToPlain(event.description, 300),
          startDate: event.startAt,
          endDate: event.endAt,
          eventStatus: event.lifecycle === "CANCELLED" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
          eventAttendanceMode:
            event.mode === "ONLINE"
              ? "https://schema.org/OnlineEventAttendanceMode"
              : event.mode === "HYBRID"
                ? "https://schema.org/MixedEventAttendanceMode"
                : "https://schema.org/OfflineEventAttendanceMode",
          location:
            event.mode === "ONLINE"
              ? { "@type": "VirtualLocation", url: event.onlineUrl ?? url }
              : { "@type": "Place", name: event.venue || site.universityName, address: site.address || site.universityName },
          image: event.poster ? [absoluteUrl(ogImage(event.poster).url)] : undefined,
          url,
          organizer: { "@type": "Organization", name: site.clubName, url: absoluteUrl("/") },
          ...(registration.reason !== "not_required" && registerHref
            ? { offers: { "@type": "Offer", url: absoluteUrl(registerHref), price: 0, priceCurrency: "INR", availability: registration.open ? "https://schema.org/InStock" : "https://schema.org/SoldOut" } }
            : {}),
        }}
      />
      <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] [mask-image:radial-gradient(ellipse_70%_70%_at_20%_0%,#000,transparent_70%)]" />

      <div className="container-x grid gap-10 pb-8 pt-8">
        <Link href="/events" className="group inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-frost">
          <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" /> All events
        </Link>

        {event.lifecycle === "CANCELLED" && (
          <p role="status" className="rounded-2xl border border-danger/40 bg-danger/10 p-5 font-display text-lg font-bold text-danger">
            This event has been cancelled. We&apos;re sorry for the change of plans.
          </p>
        )}

        <header className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          {/* The frame follows the poster's own shape, clamped between 4:5 and 16:9 so it never dominates the page. */}
          <div
            className="hero-media-in group overflow-hidden rounded-[28px] border border-line bg-night shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]"
            style={event.poster ? { aspectRatio: String(Math.min(16 / 9, Math.max(4 / 5, event.poster.width / event.poster.height))) } : undefined}
          >
            {event.poster ? (
              <PosterImage
                image={event.poster}
                sizes="(min-width: 1024px) 720px, 100vw"
                priority
                className="size-full"
                imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
              />
            ) : (
              <div aria-hidden="true" className="aspect-video bg-[radial-gradient(circle_at_80%_20%,rgb(92_201_123/0.45),transparent_45%),radial-gradient(circle_at_10%_110%,rgb(47_141_70/0.5),transparent_50%)]" />
            )}
          </div>
          <div className="hero-in-2 grid content-start gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status={status} />
              {event.category && <span className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{event.category.name}</span>}
            </div>
            <h1 className="font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-6xl">{event.title}</h1>
            {event.tagline && <p className="text-lg text-muted">{event.tagline}</p>}
            <ul className="grid gap-2 text-sm">
              <li className="flex items-center gap-2.5">
                <CalendarDays aria-hidden="true" className="size-4 text-leaf" /> {when.date}
              </li>
              <li className="flex items-center gap-2.5">
                <Clock aria-hidden="true" className="size-4 text-leaf" /> {when.time}
              </li>
              <li className="flex items-center gap-2.5">
                {event.mode === "ONLINE" ? <Globe aria-hidden="true" className="size-4 text-leaf" /> : <MapPin aria-hidden="true" className="size-4 text-leaf" />}
                {place}
                {event.mode === "HYBRID" && " · also online"}
              </li>
              {event.maxParticipants && (
                <li className="flex items-center gap-2.5">
                  <Users aria-hidden="true" className="size-4 text-leaf" />
                  <span className="font-semibold">{registration.spotsLeft !== null ? `${registration.spotsLeft} seats left` : `${event.maxParticipants} seats`}</span>
                </li>
              )}
            </ul>

            {showCountdown && <Countdown target={countdownTarget} label={event.countdownTarget === "DEADLINE" && event.registrationDeadline ? "Registration closes in" : "Starts in"} />}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {registration.open && registerHref && event.registrationMode === "EXTERNAL" && (
                <Magnetic>
                  <LinkButton href={registerHref} size="lg">
                    Register now <ArrowUpRight className="size-4" aria-hidden="true" />
                  </LinkButton>
                </Magnetic>
              )}
              {registration.open && registerHref && event.registrationMode === "FORM" && (
                <Magnetic>
                  <LinkButton href={registerHref} size="lg">
                    Join event <ArrowUpRight className="size-4" aria-hidden="true" />
                  </LinkButton>
                </Magnetic>
              )}
              {event.lifecycle === "PUBLISHED" && new Date(event.endAt) > now && (
                <a href={`/events/${event.slug}/calendar.ics`} className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold transition-colors duration-200 hover:border-leaf/40 hover:bg-raised">
                  <CalendarPlus className="size-4" aria-hidden="true" /> Add to calendar
                </a>
              )}
            </div>
            {registration.reason !== "not_required" && !registration.open && <p className="text-sm text-muted">{REASON_COPY[registration.reason]}</p>}
            {registration.reason === "not_required" && event.lifecycle === "PUBLISHED" && new Date(event.endAt) > now && (
              <p className="text-sm text-muted">{REASON_COPY.not_required}</p>
            )}
          </div>
        </header>
      </div>

      <div className="container-x grid gap-10 py-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid content-start gap-10">
          {description && (
            <section aria-labelledby="about" className="reveal grid gap-4">
              <h2 id="about" className="font-display text-2xl font-bold">
                About this event
              </h2>
              <div className="rich-text max-w-[68ch]" dangerouslySetInnerHTML={{ __html: description }} />
            </section>
          )}
          {event.eligibility && (
            <section aria-labelledby="eligibility" className="reveal grid gap-2">
              <h2 id="eligibility" className="font-display text-xl font-bold">
                Who can join
              </h2>
              <p className="max-w-[68ch] whitespace-pre-line text-muted">{event.eligibility}</p>
            </section>
          )}
          <section aria-labelledby="share" className="grid gap-3">
            <h2 id="share" className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
              Share this event
            </h2>
            <ShareButtons url={url} title={event.title} />
          </section>
        </div>

        <aside className="grid content-start gap-5">
          <section aria-labelledby="details" className="grid gap-4 rounded-3xl border border-line bg-surface p-6">
            <h2 id="details" className="font-display text-lg font-semibold">
              Details
            </h2>
            <dl className="grid gap-3 text-sm">
              <div className="grid gap-0.5">
                <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Format</dt>
                <dd>{MODE_LABELS[event.mode]}</dd>
              </div>
              {event.mode !== "OFFLINE" && event.onlineUrl && event.lifecycle === "PUBLISHED" && (
                <div className="grid gap-0.5">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Join online</dt>
                  <dd>
                    <a href={event.onlineUrl} target="_blank" rel="noopener noreferrer" className="break-all text-leaf hover:underline">
                      {event.onlineUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </dd>
                </div>
              )}
              {event.registrationDeadline && (
                <div className="grid gap-0.5">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Registration closes</dt>
                  <dd>{formatEventWhen(event.registrationDeadline, event.registrationDeadline, site.timezone).full.split(" – ")[0]}</dd>
                </div>
              )}
            </dl>
            {event.organizers.length > 0 && (
              <div className="grid gap-2 border-t border-line pt-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Organised by</p>
                <ul className="grid gap-2">
                  {event.organizers.map((o) => (
                    <li key={`${o.name}-${o.role}`} className="text-sm">
                      <span className="font-medium">{o.name}</span>
                      {o.role && <span className="text-muted"> · {o.role}</span>}
                      {o.contact && <span className="block text-xs text-muted">{o.contact}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {event.contacts.length > 0 && (
              <div className="grid gap-2 border-t border-line pt-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Questions?</p>
                <ul className="grid gap-3">
                  {event.contacts.map((c) => (
                    <li key={`${c.name}-${c.email}-${c.phone}`} className="grid gap-1 text-sm">
                      <span className="font-medium">{c.name}</span>
                      {c.phone && (
                        <a href={`tel:${c.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-muted hover:text-frost">
                          <Phone className="size-3.5" aria-hidden="true" /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-2 break-all text-muted hover:text-frost">
                          <Mail className="size-3.5" aria-hidden="true" /> {c.email}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {event.links.length > 0 && (
              <div className="grid gap-2 border-t border-line pt-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Useful links</p>
                <ul className="grid gap-1.5">
                  {event.links.map((l) => (
                    <li key={l.url}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-leaf hover:underline">
                        {l.label} <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </aside>
      </div>

      {sponsorGroups.length > 0 && (
        <section aria-labelledby="sponsors" className="container-x grid gap-6 py-10">
          <h2 id="sponsors" className="font-display text-2xl font-bold">
            Made possible by
          </h2>
          <div className="grid gap-8">
            {sponsorGroups.map((g) => (
              <div key={g.tier} className="grid gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-leaf">{SPONSOR_TIER_LABELS[g.tier]}</p>
                <ul className="flex flex-wrap gap-4">
                  {g.items.map((s) => {
                    const tile = (
                      <span className="grid h-20 min-w-40 place-items-center rounded-2xl bg-tile px-5 shadow-[0_0_0_1px_rgb(189_243_203/0.3)]">
                        {s.logo ? <Picture image={s.logo} sizes="160px" alt={s.name} imgClassName="max-h-12 w-auto object-contain" /> : <span className="font-semibold text-night">{s.name}</span>}
                      </span>
                    );
                    return (
                      <li key={s.id} className="grid justify-items-center gap-1.5">
                        {s.website ? (
                          <a href={s.website} target="_blank" rel="noopener noreferrer" className="transition-transform hover:-translate-y-0.5" aria-label={s.name}>
                            {tile}
                          </a>
                        ) : (
                          tile
                        )}
                        {s.label && <span className="text-xs text-muted">{s.label}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {registration.open && registerHref && (
        <>
          {/* Keeps the register action in reach on phones once the header CTA scrolls away. */}
          <div aria-hidden="true" className="h-24 lg:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
              <div className="grid min-w-0">
                <p className="truncate text-sm font-semibold">{event.title}</p>
                <p className="truncate text-xs text-muted">
                  {registration.spotsLeft !== null ? `${registration.spotsLeft} seats left · ` : ""}
                  {when.date}
                </p>
              </div>
              <LinkButton href={registerHref} className="shrink-0">
                {event.registrationMode === "FORM" ? "Join" : "Register"}
              </LinkButton>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
