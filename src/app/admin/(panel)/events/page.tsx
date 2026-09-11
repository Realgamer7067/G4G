import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ImageOff, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/events/status-pill";
import { Picture } from "@/components/media/picture";
import { Input } from "@/components/ui/input";
import type { Prisma } from "@/generated/prisma/client";
import { can, requireAnyPagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { formatEventWhen } from "@/lib/events/format";
import { deriveEventStatus } from "@/lib/events/status";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Events" };

const VIEWS = ["upcoming", "drafts", "past", "archived", "all"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { upcoming: "Upcoming", drafts: "Drafts", past: "Past", archived: "Archived", all: "All" };

function whereFor(view: View, now: Date): Prisma.EventWhereInput {
  switch (view) {
    case "upcoming":
      return { lifecycle: { in: ["PUBLISHED", "CANCELLED"] }, endAt: { gte: now } };
    case "drafts":
      return { lifecycle: "DRAFT" };
    case "past":
      return { lifecycle: { in: ["PUBLISHED", "CANCELLED"] }, endAt: { lt: now } };
    case "archived":
      return { lifecycle: "ARCHIVED" };
    default:
      return {};
  }
}

export default async function EventsAdminPage({ searchParams }: PageProps<"/admin/events">) {
  const me = await requireAnyPagePermission(["events.create", "events.edit", "events.publish", "events.delete"]);
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "upcoming";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const now = new Date();
  const { timezone } = await loadSiteSettings();

  const where: Prisma.EventWhereInput = { AND: [whereFor(view, now), q ? { title: { contains: q, mode: "insensitive" } } : {}] };
  const [events, ...counts] = await Promise.all([
    db.event.findMany({
      where,
      include: { poster: { select: publicImageSelect }, category: { select: { name: true } } },
      orderBy: { startAt: view === "upcoming" ? "asc" : "desc" },
      take: 100,
    }),
    ...VIEWS.map((v) => db.event.count({ where: whereFor(v, now) })),
  ]);

  return (
    <div className="grid max-w-6xl gap-8">
      <PageHeader
        eyebrow="Content"
        title="Events"
        description="Create, publish and manage every chapter event."
        actions={
          <>
            {can(me, "events.edit") && (
              <Link href="/admin/events/categories" className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm text-muted hover:text-frost">
                Categories
              </Link>
            )}
            {can(me, "events.create") && (
              <Link href="/admin/events/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
                <Plus className="size-4" aria-hidden="true" /> New event
              </Link>
            )}
          </>
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Event deleted.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter events" className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
          {VIEWS.map((v, i) => (
            <Link
              key={v}
              href={`/admin/events?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={v === view ? "page" : undefined}
              className={cn("rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-frost", v === view && "bg-raised text-frost")}
            >
              {VIEW_LABELS[v]} <span className="text-xs text-muted">{counts[i]}</span>
            </Link>
          ))}
        </nav>
        <form method="get" className="relative w-full sm:w-72">
          <input type="hidden" name="view" value={view} />
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Search by title" aria-label="Search events" className="pl-9" />
        </form>
      </div>

      {events.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">{q ? "No events match that search." : `No ${VIEW_LABELS[view].toLowerCase()} events.`}</p>
          {can(me, "events.create") && view !== "archived" && (
            <Link href="/admin/events/new" className="text-sm text-leaf hover:underline">
              Create an event
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {events.map((e) => {
            const poster = toPublicImage(e.poster);
            const when = formatEventWhen(e.startAt, e.endAt, timezone);
            return (
              <li key={e.id}>
                <Link href={`/admin/events/${e.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-leaf/30">
                  <span className="relative hidden aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-night sm:block">
                    {poster ? (
                      <Picture image={poster} sizes="128px" alt="" imgClassName="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-muted">
                        <ImageOff className="size-5" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate font-semibold">{e.title}</span>
                    <span className="truncate text-sm text-muted">{when.full}</span>
                    {e.category && <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{e.category.name}</span>}
                  </span>
                  <StatusPill status={deriveEventStatus(e, null, now)} className="shrink-0" />
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
