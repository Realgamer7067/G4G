import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { DeleteSponsorForm, SponsorForm } from "../sponsor-form";

export const metadata: Metadata = { title: "Edit sponsor" };

export default async function EditSponsorPage({ params, searchParams }: PageProps<"/admin/sponsors/[id]">) {
  await requirePagePermission("sponsors.manage");
  const { id } = await params;
  const sp = await searchParams;
  const sponsor = await db.sponsor.findUnique({
    where: { id },
    include: { logo: { select: publicImageSelect }, events: { include: { event: { select: { id: true, title: true } } } } },
  });
  if (!sponsor) notFound();
  const logo = toPublicImage(sponsor.logo);
  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/admin/sponsors" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All sponsors
      </Link>
      <PageHeader eyebrow="Sponsor" title={sponsor.name} />
      {sp.created && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Sponsor added. You can now pick it in any event&apos;s sponsor list.
        </p>
      )}
      <SponsorForm
        values={{
          id: sponsor.id,
          name: sponsor.name,
          logo: logo ? { id: logo.id, url: imageUrl(logo, 400), alt: logo.alt } : null,
          website: sponsor.website ?? "",
          description: sponsor.description,
          tier: sponsor.tier,
          customLabel: sponsor.customLabel ?? "",
          showOnSponsorsPage: sponsor.showOnSponsorsPage,
          isActive: sponsor.isActive,
          order: sponsor.order,
        }}
      />
      <Panel title={`Events (${sponsor.events.length})`}>
        {sponsor.events.length === 0 ? (
          <p className="text-sm text-muted">Not on any event yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sponsor.events.map((e) => (
              <li key={e.event.id}>
                <Link href={`/admin/events/${e.event.id}`} className="inline-flex rounded-full border border-line px-3 py-1 text-sm hover:border-leaf/40">
                  {e.event.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Delete sponsor" description="Removes the sponsor from every event it appears on.">
        <DeleteSponsorForm id={sponsor.id} eventCount={sponsor.events.length} />
      </Panel>
    </div>
  );
}
