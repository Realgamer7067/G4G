import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel } from "@/components/admin/page-header";
import { QrPanel } from "@/components/admin/qr-panel";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { utcToZonedInput } from "@/lib/utils/timezone";
import { FormHeader } from "../form-header";
import { DangerZone, FormSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Form settings" };

export default async function FormSettingsPage({ params }: PageProps<"/admin/forms/[id]/settings">) {
  const me = await requirePagePermission("forms.edit");
  const { id } = await params;
  const form = await db.form.findUnique({ where: { id }, include: { cover: { select: publicImageSelect }, _count: { select: { responses: true } } } });
  if (!form) notFound();
  const { timezone } = await loadSiteSettings();
  const cover = toPublicImage(form.cover);
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <div className="grid max-w-4xl gap-8">
      <FormHeader user={me} form={form} active="settings" responseCount={form._count.responses} />
      <FormSettingsForm
        timezone={timezone}
        values={{
          id: form.id,
          name: form.name,
          slug: form.slug,
          description: form.description,
          cover: cover ? { id: cover.id, url: imageUrl(cover, 800), alt: cover.alt } : null,
          visibility: form.visibility,
          acceptingResponses: form.acceptingResponses,
          opensAt: form.opensAt ? utcToZonedInput(form.opensAt, timezone) : "",
          closesAt: form.closesAt ? utcToZonedInput(form.closesAt, timezone) : "",
          maxResponses: form.maxResponses?.toString() ?? "",
          oneResponsePerEmail: form.oneResponsePerEmail,
          successMessage: form.successMessage,
          submitLabel: form.submitLabel,
          reviewStep: form.reviewStep,
        }}
      />
      {form.visibility === "PUBLIC_LINK" && (
        <Panel title="Share" description={form.publishedVersionId ? "Print the QR code or share the link." : "Publish the form in the builder before sharing it."}>
          <QrPanel targets={[{ key: "form", label: "Form", target: `form:${form.id}`, url: `${base}/forms/${form.slug}` }]} />
        </Panel>
      )}
      <Panel title="More" description="Duplicating copies the questions and settings, not the responses.">
        <DangerZone id={form.id} canDuplicate={can(me, "forms.create")} canDelete={can(me, "forms.delete")} />
      </Panel>
    </div>
  );
}
