import "server-only";
import { unstable_cache } from "next/cache";
import type { ContentImage } from "@/components/forms/form-wizard";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { resolveContentImages } from "@/lib/forms/content-images";
import { formDefinitionSchema, type FormDefinition } from "@/lib/forms/engine/schema";
import { publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";
import { formatInZone } from "@/lib/utils/timezone";

export type PublicFormDTO = {
  id: string;
  slug: string;
  name: string;
  description: string;
  visibility: "PUBLIC_LINK" | "EVENT_ONLY";
  acceptingResponses: boolean;
  opensAt: string | null;
  closesAt: string | null;
  maxResponses: number | null;
  successMessage: string;
  submitLabel: string;
  reviewStep: boolean;
  cover: PublicImage | null;
  versionId: string;
  definition: FormDefinition;
  images: Record<string, ContentImage>;
};

export async function loadPublicForm(slug: string): Promise<PublicFormDTO | null> {
  const form = await db.form.findUnique({ where: { slug }, include: { publishedVersion: true, cover: { select: publicImageSelect } } });
  if (!form?.publishedVersion) return null;
  const parsed = formDefinitionSchema.safeParse(form.publishedVersion.definition);
  if (!parsed.success) return null;

  const images = await resolveContentImages(parsed.data);

  return {
    id: form.id,
    slug: form.slug,
    name: form.name,
    description: form.description,
    visibility: form.visibility,
    acceptingResponses: form.acceptingResponses,
    opensAt: form.opensAt?.toISOString() ?? null,
    closesAt: form.closesAt?.toISOString() ?? null,
    maxResponses: form.maxResponses,
    successMessage: form.successMessage,
    submitLabel: form.submitLabel,
    reviewStep: form.reviewStep,
    cover: toPublicImage(form.cover),
    versionId: form.publishedVersion.id,
    definition: parsed.data,
    images,
  };
}

export function getPublicForm(slug: string): Promise<PublicFormDTO | null> {
  return unstable_cache(() => loadPublicForm(slug), ["public-form", slug], { tags: [TAGS.forms, `form:${slug}`] })();
}

/** Why a standalone form can't take responses right now, or null when it can. */
export function formClosedReason(form: Pick<PublicFormDTO, "acceptingResponses" | "opensAt" | "closesAt" | "maxResponses">, count: number, timeZone: string, now: Date = new Date()): string | null {
  if (!form.acceptingResponses) return "This form isn't accepting responses right now.";
  if (form.opensAt && new Date(form.opensAt) > now) {
    return `This form opens on ${formatInZone(form.opensAt, timeZone, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.`;
  }
  if (form.closesAt && new Date(form.closesAt) <= now) return "This form has closed.";
  if (form.maxResponses !== null && count >= form.maxResponses) return "All spots are taken. Registrations are closed.";
  return null;
}
