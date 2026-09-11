"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { TAGS, invalidate, type CacheTag } from "@/lib/cache-tags";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { resolveContentImages } from "@/lib/forms/content-images";
import { defaultDefinition } from "@/lib/forms/defaults";
import { formDefinitionSchema, type FormDefinition } from "@/lib/forms/engine/schema";
import { validateDefinition, type DefinitionIssue } from "@/lib/forms/engine/validate-definition";
import { formSettingsSchema } from "@/lib/forms/settings-schema";
import { getRequestMeta } from "@/lib/request-meta";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { zonedToUtc } from "@/lib/utils/timezone";
import { ensureImages, updateImageAlt } from "@/server/media/images";
import { deleteUploadFiles } from "@/server/media/save-image";

const actorOf = (u: SessionUser) => ({ id: u.id, name: u.name });

function uniqueFormSlug(base: string, excludeId: string | null) {
  return uniqueSlug(base || "form", async (s) => {
    const hit = await db.form.findUnique({ where: { slug: s }, select: { id: true } });
    return Boolean(hit && hit.id !== excludeId);
  });
}

async function eventTagsFor(formId: string): Promise<CacheTag[]> {
  const events = await db.event.findMany({ where: { formId }, select: { slug: true } });
  return [TAGS.events, ...events.map((e) => `event:${e.slug}` as const)];
}

export async function createFormAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("forms.create");
    const { name } = z.object({ name: z.string().trim().min(2, "Name the form.").max(120) }).parse({ name: formData.get("name") });
    const slug = await uniqueFormSlug(slugify(name), null);
    const meta = await getRequestMeta();
    createdId = await db.$transaction(async (tx) => {
      const form = await tx.form.create({
        data: { name, slug, draftDefinition: defaultDefinition(), createdById: user.id, hasUnpublishedChanges: true },
      });
      await writeAuditLog(tx, { actor: actorOf(user), action: "form.created", target: { type: "Form", id: form.id, label: name }, meta });
      return form.id;
    });
    return null;
  });
  if (createdId) redirect(`/admin/forms/${createdId}/build?created=1`);
  return result;
}

/** Builder autosave: stores the draft if its shape is valid and reports logic issues without blocking. */
export async function saveFormDraftAction(formId: string, definition: unknown): Promise<ActionResult<{ savedAt: string; issues: DefinitionIssue[] }>> {
  return runAction(async () => {
    await requirePermission("forms.edit");
    const parsed = formDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue.path.includes("label") ? "Every question and option needs a label." : issue.message;
      throw new UserError(`Not saved yet. ${where}`);
    }
    const { count } = await db.form.updateMany({ where: { id: formId }, data: { draftDefinition: parsed.data, hasUnpublishedChanges: true } });
    if (!count) throw new UserError("That form no longer exists.");
    const check = validateDefinition(parsed.data);
    return { savedAt: new Date().toISOString(), issues: check.ok ? [] : check.issues };
  });
}

/** Live preview inside the builder: resolves image blocks to URLs as the draft changes (unsaved edits included). */
export async function resolvePreviewImagesAction(definition: FormDefinition) {
  await requirePermission("forms.edit");
  return resolveContentImages(definition);
}

/** Alt text for a content-image block, edited after upload (the upload endpoint only takes the alt text it's given at upload time). */
export async function updateContentImageAltAction(uploadId: string, alt: string): Promise<ActionResult> {
  return runAction(async () => {
    await requirePermission("forms.edit");
    const { count } = await db.upload.updateMany({ where: { id: uploadId, kind: "IMAGE", visibility: "PUBLIC" }, data: { alt: alt.trim().slice(0, 300) } });
    if (!count) throw new UserError("That image is no longer available.");
    return null;
  });
}

export async function publishFormAction(formId: string): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    const user = await requirePermission("forms.edit");
    const form = await db.form.findUnique({ where: { id: formId } });
    if (!form) throw new UserError("That form no longer exists.");
    const check = validateDefinition(form.draftDefinition);
    if (!check.ok) {
      throw new UserError(
        "Fix the issues listed before publishing.",
        Object.fromEntries(check.issues.map((i) => [i.path, [i.message]])),
      );
    }
    const meta = await getRequestMeta();
    const version = await db.$transaction(async (tx) => {
      const last = await tx.formVersion.aggregate({ where: { formId }, _max: { version: true } });
      const next = (last._max.version ?? 0) + 1;
      const created = await tx.formVersion.create({
        data: { formId, version: next, definition: form.draftDefinition as Prisma.InputJsonValue, createdById: user.id },
      });
      await tx.form.update({ where: { id: formId }, data: { publishedVersionId: created.id, hasUnpublishedChanges: false } });
      await writeAuditLog(tx, { actor: actorOf(user), action: "form.published", target: { type: "Form", id: formId, label: form.name }, metadata: { version: next }, meta });
      return next;
    });
    invalidate(TAGS.forms, `form:${form.slug}`, ...(await eventTagsFor(formId)));
    revalidatePath(`/admin/forms/${formId}/build`);
    return { version };
  });
}

export async function saveFormSettingsAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("forms.edit");
    const input = formSettingsSchema.parse(Object.fromEntries(formData));
    const form = await db.form.findUnique({ where: { id: input.id } });
    if (!form) throw new UserError("That form no longer exists.");
    const { timezone } = await loadSiteSettings();
    const slug = await uniqueFormSlug(slugify(input.slug || input.name), form.id);
    const data = {
      name: input.name,
      slug,
      description: input.description,
      coverId: input.coverId,
      visibility: input.visibility,
      acceptingResponses: input.acceptingResponses,
      opensAt: input.opensAt ? zonedToUtc(input.opensAt, timezone) : null,
      closesAt: input.closesAt ? zonedToUtc(input.closesAt, timezone) : null,
      maxResponses: input.maxResponses,
      oneResponsePerEmail: input.oneResponsePerEmail,
      successMessage: input.successMessage,
      submitLabel: input.submitLabel,
      reviewStep: input.reviewStep,
    };
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await ensureImages(tx, [input.coverId]);
      await tx.form.update({ where: { id: form.id }, data });
      await updateImageAlt(tx, input.coverId, formData.get("coverIdAlt"));
      const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => {
        const a = form[k];
        const b = data[k];
        return (a instanceof Date ? a.getTime() : a) !== (b instanceof Date ? b.getTime() : b);
      });
      await writeAuditLog(tx, { actor: actorOf(user), action: "form.settings_updated", target: { type: "Form", id: form.id, label: input.name }, metadata: { changed }, meta });
    });
    invalidate(TAGS.forms, `form:${slug}`, `form:${form.slug}`, ...(await eventTagsFor(form.id)));
    revalidatePath(`/admin/forms/${form.id}/settings`);
    return null;
  });
}

export async function duplicateFormAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let newId: string | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("forms.create");
    const source = await db.form.findUnique({ where: { id: String(formData.get("id") ?? "") } });
    if (!source) throw new UserError("That form no longer exists.");
    const slug = await uniqueFormSlug(slugify(`${source.name} copy`), null);
    const meta = await getRequestMeta();
    newId = await db.$transaction(async (tx) => {
      const copy = await tx.form.create({
        data: {
          name: `${source.name} (copy)`,
          slug,
          description: source.description,
          coverId: source.coverId,
          visibility: source.visibility,
          acceptingResponses: source.acceptingResponses,
          maxResponses: source.maxResponses,
          oneResponsePerEmail: source.oneResponsePerEmail,
          successMessage: source.successMessage,
          submitLabel: source.submitLabel,
          reviewStep: source.reviewStep,
          draftDefinition: source.draftDefinition as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });
      await writeAuditLog(tx, { actor: actorOf(user), action: "form.duplicated", target: { type: "Form", id: copy.id, label: copy.name }, metadata: { from: source.name }, meta });
      return copy.id;
    });
    return null;
  });
  if (newId) redirect(`/admin/forms/${newId}/build?duplicated=1`);
  return result;
}

export async function deleteFormAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("forms.delete");
    const form = await db.form.findUnique({ where: { id: String(formData.get("id") ?? "") }, include: { events: { select: { title: true } } } });
    if (!form) throw new UserError("That form no longer exists.");
    if (form.events.length) {
      throw new UserError(`This form is the registration form for ${form.events.map((e) => `“${e.title}”`).join(", ")}. Change those events first.`);
    }
    const files = await db.upload.findMany({ where: { formResponse: { formId: form.id } }, select: { id: true, storageKey: true, visibility: true } });
    const responses = await db.formResponse.count({ where: { formId: form.id } });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.upload.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
      await tx.form.delete({ where: { id: form.id } });
      await writeAuditLog(tx, { actor: actorOf(user), action: "form.deleted", target: { type: "Form", id: form.id, label: form.name }, metadata: { responses, files: files.length }, meta });
    });
    await Promise.all(files.map((f) => deleteUploadFiles(f)));
    invalidate(TAGS.forms, `form:${form.slug}`);
    return null;
  });
  if (result.ok) redirect("/admin/forms?deleted=1");
  return result;
}

export async function deleteResponsesAction(_prev: ActionResult<{ deleted: number }> | undefined, formData: FormData): Promise<ActionResult<{ deleted: number }>> {
  return runAction(async () => {
    const user = await requirePermission("forms.responses.delete");
    const formId = String(formData.get("formId") ?? "");
    const ids = formData.getAll("ids").map(String).filter(Boolean).slice(0, 500);
    if (ids.length === 0) throw new UserError("Select at least one response.");
    const form = await db.form.findUnique({ where: { id: formId } });
    if (!form) throw new UserError("That form no longer exists.");
    const responses = await db.formResponse.findMany({ where: { id: { in: ids }, formId }, select: { id: true, event: { select: { slug: true } } } });
    const files = await db.upload.findMany({ where: { formResponseId: { in: responses.map((r) => r.id) } }, select: { id: true, storageKey: true, visibility: true } });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.upload.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
      await tx.formResponse.deleteMany({ where: { id: { in: responses.map((r) => r.id) } } });
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: "form.responses_deleted",
        target: { type: "Form", id: form.id, label: form.name },
        metadata: { count: responses.length },
        meta,
      });
    });
    await Promise.all(files.map((f) => deleteUploadFiles(f)));
    const eventSlugs = [...new Set(responses.map((r) => r.event?.slug).filter((s): s is string => !!s))];
    invalidate(`form:${form.slug}`, ...(eventSlugs.length ? [TAGS.events, ...eventSlugs.map((s) => `event:${s}` as const)] : []));
    revalidatePath(`/admin/forms/${form.id}/responses`);
    return { deleted: responses.length };
  });
}
