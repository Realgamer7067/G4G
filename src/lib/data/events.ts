import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import type { StatusInput } from "@/lib/events/status";
import { publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";

type SponsorTier = "TITLE" | "POWERED_BY" | "COMMUNITY_PARTNER" | "TECHNOLOGY_PARTNER" | "PARTNER";

export type EventSponsorDTO = { id: string; name: string; website: string | null; logo: PublicImage | null; type: SponsorTier; label: string | null };

export type EventCardDTO = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  startAt: string;
  endAt: string;
  venue: string;
  mode: "OFFLINE" | "ONLINE" | "HYBRID";
  lifecycle: "PUBLISHED" | "CANCELLED";
  registrationMode: "NONE" | "FORM" | "EXTERNAL";
  registrationDeadline: string | null;
  maxParticipants: number | null;
  externalRegistrationUrl: string | null;
  featured: boolean;
  category: { name: string; slug: string } | null;
  poster: PublicImage | null;
  headlineSponsor: EventSponsorDTO | null;
  /** Registrations so far (FORM mode; wired up with the form engine). */
  registrationCount: number;
  formAccepting: boolean;
};

export type EventDetailDTO = EventCardDTO & {
  description: string;
  eligibility: string;
  onlineUrl: string | null;
  organizers: { name: string; role: string; contact: string }[];
  contacts: { name: string; phone: string; email: string }[];
  links: { label: string; url: string }[];
  sponsors: EventSponsorDTO[];
  showCountdown: boolean;
  countdownTarget: "START" | "DEADLINE";
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
};

const PUBLIC_LIFECYCLES = ["PUBLISHED", "CANCELLED"] as const;

const include = {
  poster: { select: publicImageSelect },
  category: { select: { name: true, slug: true } },
  sponsors: {
    orderBy: { order: "asc" as const },
    include: { sponsor: { include: { logo: { select: publicImageSelect } } } },
  },
};

type EventRow = NonNullable<Awaited<ReturnType<typeof findEvent>>>;
function findEvent(slug: string) {
  return db.event.findFirst({ where: { slug, lifecycle: { in: [...PUBLIC_LIFECYCLES] } }, include });
}

function sponsorsOf(row: EventRow): EventSponsorDTO[] {
  return row.sponsors.map((s) => ({
    id: s.sponsor.id,
    name: s.sponsor.name,
    website: s.sponsor.website,
    logo: toPublicImage(s.sponsor.logo),
    type: s.type,
    label: s.customLabel,
  }));
}

function toCard(row: EventRow): EventCardDTO {
  const sponsors = sponsorsOf(row);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    venue: row.venue,
    mode: row.mode,
    lifecycle: row.lifecycle as EventCardDTO["lifecycle"],
    registrationMode: row.registrationMode,
    registrationDeadline: row.registrationDeadline?.toISOString() ?? null,
    maxParticipants: row.maxParticipants,
    externalRegistrationUrl: row.externalRegistrationUrl,
    featured: row.featured,
    category: row.category,
    poster: toPublicImage(row.poster),
    headlineSponsor: sponsors.find((s) => s.type === "TITLE") ?? sponsors.find((s) => s.type === "POWERED_BY") ?? null,
    registrationCount: 0,
    formAccepting: false,
  };
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export async function loadPublicEvents(): Promise<EventCardDTO[]> {
  const rows = await db.event.findMany({ where: { lifecycle: { in: [...PUBLIC_LIFECYCLES] } }, include, orderBy: { startAt: "desc" } });
  return rows.map(toCard);
}

export const getPublicEvents = unstable_cache(loadPublicEvents, ["public-events"], { tags: [TAGS.events] });

export async function loadPublicEvent(slug: string): Promise<EventDetailDTO | null> {
  const row = await findEvent(slug);
  if (!row) return null;
  return {
    ...toCard(row),
    description: row.description,
    eligibility: row.eligibility,
    onlineUrl: row.onlineUrl,
    organizers: asArray(row.organizers),
    contacts: asArray(row.contacts),
    links: asArray(row.links),
    sponsors: sponsorsOf(row),
    showCountdown: row.showCountdown,
    countdownTarget: row.countdownTarget,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function getPublicEvent(slug: string): Promise<EventDetailDTO | null> {
  return unstable_cache(() => loadPublicEvent(slug), ["public-event", slug], { tags: [TAGS.events, `event:${slug}`] })();
}

/** Revive the dates the cache serialised, for status helpers. */
export function statusInputOf(e: EventCardDTO): StatusInput {
  return {
    lifecycle: e.lifecycle,
    startAt: new Date(e.startAt),
    endAt: new Date(e.endAt),
    registrationMode: e.registrationMode,
    registrationDeadline: e.registrationDeadline ? new Date(e.registrationDeadline) : null,
    maxParticipants: e.maxParticipants,
  };
}

export function statsOf(e: EventCardDTO) {
  return e.registrationMode === "FORM" ? { count: e.registrationCount, formAccepting: e.formAccepting } : null;
}
