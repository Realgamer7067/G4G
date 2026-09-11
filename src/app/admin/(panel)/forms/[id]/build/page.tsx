import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { resolveContentImages } from "@/lib/forms/content-images";
import { formDefinitionSchema } from "@/lib/forms/engine/schema";
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { FormHeader } from "../form-header";
import { FormBuilder } from "./form-builder";

export const metadata: Metadata = { title: "Build" };

export default async function FormBuilderPage({ params, searchParams }: PageProps<"/admin/forms/[id]/build">) {
  const me = await requirePagePermission("forms.edit");
  const { id } = await params;
  const sp = await searchParams;
  const form = await db.form.findUnique({ where: { id }, include: { cover: { select: publicImageSelect }, _count: { select: { responses: true } } } });
  if (!form) notFound();

  const parsed = formDefinitionSchema.safeParse(form.draftDefinition);
  // draftDefinition is always written by publishFormAction/saveFormDraftAction through the schema, so this
  // only fails if the DB row was edited out of band; fall back to an empty starter page rather than crash.
  const definition = parsed.success ? parsed.data : { pages: [{ id: "page_1", title: "Page 1", description: "", blocks: [], branches: [], defaultNext: "next" as const }] };
  const cover = toPublicImage(form.cover);
  const images = await resolveContentImages(definition);

  return (
    <div className="grid gap-6">
      <FormHeader user={me} form={form} active="build" responseCount={form._count.responses} />
      <FormBuilder
        formId={form.id}
        slug={form.slug}
        initialDefinition={definition}
        justCreated={sp.created === "1"}
        justDuplicated={sp.duplicated === "1"}
        preview={{
          title: form.name,
          description: form.description,
          submitLabel: form.submitLabel,
          successMessage: form.successMessage,
          reviewStep: form.reviewStep,
          cover: cover ? { id: cover.id, url: imageUrl(cover, 800), alt: cover.alt } : null,
          images,
        }}
      />
    </div>
  );
}
