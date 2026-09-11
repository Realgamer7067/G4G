import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/admin/page-header";
import { QrPanel, type QrTarget } from "@/components/admin/qr-panel";
import { StatusPill } from "@/components/events/status-pill";
import { can, requireAnyPagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { formatEventWhen } from "@/lib/events/format";
import { allowedTransitions } from "@/lib/events/lifecycle";
import { deriveEventStatus } from "@/lib/events/status";
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { utcToZonedInput } from "@/lib/utils/timezone";
import { EventEditor } from "../event-editor";
import { LifecycleBar } from "../lifecycle-bar";

export const metadata: Metadata = { title: "Edit event" };

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export default async function EditEventPage({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const me = await requireAnyPagePermission(["events.edit", "events.publish", "events.delete", "events.create"]);
  const { id } = await params;
  const sp = await searchParams;
  const event = await db.event.findUnique({
    where: { id },
    include: { poster: { select: publicImageSelect }, sponsors: { orderBy: { order: "asc" } } },
  });
  if (!event) notFound();

  const [{ timezone }, categories, sponsors, forms] = await Promise.all([
    loadSiteSettings(),
    db.eventCategory.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.sponsor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } }),
    db.form.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, publishedVersionId: true } }),
  ]);
  const poster = toPublicImage(event.poster);
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const isPublic = event.lifecycle === "PUBLISHED" || event.lifecycle === "CANCELLED";
  const qrTargets: QrTarget[] = [{ key: "page", label: "Event page", target: `event:${event.id}`, url: `${base}/events/${event.slug}` }];
  if (event.registrationMode === "EXTERNAL" && event.externalRegistrationUrl) {
    qrTargets.push({ key: "register", label: "Registration", target: `register:${event.id}`, url: event.externalRegistrationUrl });
  }
  if (event.registrationMode === "FORM" && event.formId) {
    qrTargets.push({ key: "register", label: "Registration", target: `register:${event.id}`, url: `${base}/events/${event.slug}/register` });
  }

  return (
    <div className="grid max-w-4xl gap-8">
      <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All events
      </Link>

      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={deriveEventStatus(event, null, new Date())} />
          <span className="text-sm text-muted">{formatEventWhen(event.startAt, event.endAt, timezone).full}</span>
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{event.title}</h1>
        <LifecycleBar
          id={event.id}
          lifecycle={event.lifecycle}
          transitions={[...allowedTransitions(event.lifecycle)]}
          publicUrl={isPublic ? `/events/${event.slug}` : null}
          can={{ publish: can(me, "events.publish"), create: can(me, "events.create"), delete: can(me, "events.delete") }}
        />
      </header>

      {(sp.created || sp.duplicated) && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          {sp.created ? "Draft created. Add a poster and description, then publish when it's ready." : "Copy created as a draft. Update the dates before publishing."}
        </p>
      )}

      {can(me, "events.edit") ? (
        <>
          <EventEditor
            timezone={timezone}
            categories={categories}
            forms={forms.map((f) => ({ id: f.id, name: f.name, published: f.publishedVersionId !== null }))}
            sponsors={sponsors.filter((s) => s.isActive || event.sponsors.some((x) => x.sponsorId === s.id))}
            values={{
              id: event.id,
              title: event.title,
              slug: event.slug,
              tagline: event.tagline,
              description: event.description,
              poster: poster ? { id: poster.id, url: imageUrl(poster, 800), alt: poster.alt } : null,
              categoryId: event.categoryId,
              startAt: utcToZonedInput(event.startAt, timezone),
              endAt: utcToZonedInput(event.endAt, timezone),
              venue: event.venue,
              mode: event.mode,
              onlineUrl: event.onlineUrl ?? "",
              registrationMode: event.registrationMode,
              formId: event.formId,
              externalRegistrationUrl: event.externalRegistrationUrl ?? "",
              registrationDeadline: event.registrationDeadline ? utcToZonedInput(event.registrationDeadline, timezone) : "",
              maxParticipants: event.maxParticipants?.toString() ?? "",
              eligibility: event.eligibility,
              organizers: asArray(event.organizers),
              contacts: asArray(event.contacts),
              links: asArray(event.links),
              sponsors: event.sponsors.map((s) => ({ sponsorId: s.sponsorId, type: s.type, customLabel: s.customLabel ?? "" })),
              showCountdown: event.showCountdown,
              countdownTarget: event.countdownTarget,
              featured: event.featured,
              seoTitle: event.seoTitle ?? "",
              seoDescription: event.seoDescription ?? "",
            }}
          />
          <Panel title="QR codes" description="Print on posters and standees. The code always points to the address shown.">
            <QrPanel targets={qrTargets} />
          </Panel>
        </>
      ) : (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">You can change this event&apos;s status, but editing its details needs the “Edit events” permission.</p>
      )}
    </div>
  );
}
