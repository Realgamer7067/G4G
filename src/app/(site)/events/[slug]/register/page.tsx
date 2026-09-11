import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClosedCard } from "@/components/forms/closed-card";
import { FormWizard, type WizardMeta } from "@/components/forms/form-wizard";
import { Picture } from "@/components/media/picture";
import { assertPageEnabled } from "@/lib/data/pages";
import { getPublicEvent, statsOf, statusInputOf } from "@/lib/data/events";
import { getPublicForm } from "@/lib/data/forms";
import { getSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { formatEventWhen } from "@/lib/events/format";
import { REASON_COPY, registrationState } from "@/lib/events/status";

export async function generateMetadata({ params }: PageProps<"/events/[slug]/register">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  return { title: event ? `Register · ${event.title}` : "Register", robots: { index: false, follow: false } };
}

export default async function RegisterPage({ params }: PageProps<"/events/[slug]/register">) {
  await assertPageEnabled("EVENTS");
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event || event.registrationMode !== "FORM" || !event.form) notFound();
  const [form, site, count] = await Promise.all([getPublicForm(event.form.slug), getSiteSettings(), db.formResponse.count({ where: { eventId: event.id } })]);
  if (!form) notFound();

  const now = new Date();
  const live = { ...event, registrationCount: count };
  const state = registrationState(statusInputOf(live), statsOf(live, now), now);
  const when = formatEventWhen(event.startAt, event.endAt, site.timezone);
  const meta: WizardMeta[] = [
    { icon: "calendar", text: when.date },
    { icon: "clock", text: when.time },
    { icon: "pin", text: event.mode === "ONLINE" ? "Online" : event.venue || "Venue to be announced" },
  ];
  if (state.spotsLeft !== null) meta.push({ icon: "seats", text: `${state.spotsLeft} seats left`, strong: true });

  return (
    <div className="relative isolate px-4 py-8 sm:px-6 sm:py-12">
      {event.poster && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <Picture image={event.poster} sizes="100vw" alt="" imgClassName="size-full scale-110 object-cover opacity-35 blur-3xl" />
          <div className="absolute inset-0 bg-night/70" />
        </div>
      )}
      {!state.open ? (
        <ClosedCard title={event.title} reason={REASON_COPY[state.reason]} backHref={`/events/${event.slug}`} backLabel="Back to the event" />
      ) : (
        <FormWizard
          slug={form.slug}
          versionId={form.versionId}
          definition={form.definition}
          title={event.title}
          eyebrow={event.category?.name}
          description={form.description}
          submitLabel={form.submitLabel}
          successMessage={form.successMessage}
          reviewStep={form.reviewStep}
          cover={event.poster}
          meta={meta}
          images={form.images}
          eventSlug={event.slug}
          closeHref={`/events/${event.slug}`}
          calendarUrl={`/events/${event.slug}/calendar.ics`}
        />
      )}
    </div>
  );
}
