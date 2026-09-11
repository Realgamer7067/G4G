import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { EventEditor } from "../event-editor";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requirePagePermission("events.create");
  const [{ timezone }, categories, sponsors, forms] = await Promise.all([
    loadSiteSettings(),
    db.eventCategory.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.sponsor.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.form.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, publishedVersionId: true } }),
  ]);
  return (
    <div className="grid max-w-4xl gap-8">
      <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All events
      </Link>
      <PageHeader eyebrow="Events" title="New event" description="Saved as a draft. Nothing appears on the website until you publish it." />
      <EventEditor
        timezone={timezone}
        categories={categories}
        sponsors={sponsors}
        forms={forms.map((f) => ({ id: f.id, name: f.name, published: f.publishedVersionId !== null }))}
        values={{
          id: null,
          title: "",
          slug: "",
          tagline: "",
          description: "",
          poster: null,
          categoryId: null,
          startAt: "",
          endAt: "",
          venue: "",
          mode: "OFFLINE",
          onlineUrl: "",
          registrationMode: "NONE",
          formId: null,
          externalRegistrationUrl: "",
          registrationDeadline: "",
          maxParticipants: "",
          eligibility: "",
          organizers: [],
          contacts: [],
          links: [],
          sponsors: [],
          showCountdown: true,
          countdownTarget: "START",
          featured: false,
          seoTitle: "",
          seoDescription: "",
        }}
      />
    </div>
  );
}
