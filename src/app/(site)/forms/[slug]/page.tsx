import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClosedCard } from "@/components/forms/closed-card";
import { FormWizard, type WizardMeta } from "@/components/forms/form-wizard";
import { Rings } from "@/components/site/rings";
import { formClosedReason, getPublicForm } from "@/lib/data/forms";
import { getSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { formatInZone } from "@/lib/utils/timezone";

export async function generateMetadata({ params }: PageProps<"/forms/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const form = await getPublicForm(slug);
  if (!form || form.visibility !== "PUBLIC_LINK") return { robots: { index: false, follow: false } };
  return { title: form.name, description: form.description.slice(0, 160) || undefined, robots: { index: false, follow: false } };
}

export default async function PublicFormPage({ params }: PageProps<"/forms/[slug]">) {
  const { slug } = await params;
  const form = await getPublicForm(slug);
  if (!form || form.visibility !== "PUBLIC_LINK") notFound();

  const [count, site] = await Promise.all([db.formResponse.count({ where: { formId: form.id } }), getSiteSettings()]);
  const reason = formClosedReason(form, count, site.timezone);
  const meta: WizardMeta[] = [];
  if (form.closesAt) {
    meta.push({ icon: "closes", text: `Closes ${formatInZone(form.closesAt, site.timezone, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` });
  }
  if (form.maxResponses !== null) meta.push({ icon: "seats", text: `${Math.max(0, form.maxResponses - count)} spots left`, strong: true });

  return (
    <div className="relative isolate px-4 py-10 sm:px-6 sm:py-14">
      <Rings className="pointer-events-none absolute -left-60 top-0 -z-10 size-[720px] opacity-35" />
      {reason ? (
        <ClosedCard title={form.name} reason={reason} backHref="/" backLabel="Back to home" />
      ) : (
        <FormWizard
          slug={form.slug}
          versionId={form.versionId}
          definition={form.definition}
          title={form.name}
          eyebrow={site.shortName}
          description={form.description}
          submitLabel={form.submitLabel}
          successMessage={form.successMessage}
          reviewStep={form.reviewStep}
          cover={form.cover}
          meta={meta}
          images={form.images}
        />
      )}
    </div>
  );
}
