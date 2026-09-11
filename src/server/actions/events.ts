"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { TAGS, invalidate, type CacheTag } from "@/lib/cache-tags";
import { sanitizeRichText } from "@/lib/content/sanitize";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { canTransition, transitionAction, type Lifecycle } from "@/lib/events/lifecycle";
import { EVENT_JSON_KEYS, eventFormSchema } from "@/lib/events/schema";
import { formDataToObject } from "@/lib/forms-data";
import { getRequestMeta } from "@/lib/request-meta";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { zonedToUtc } from "@/lib/utils/timezone";
import { ensureImages, updateImageAlt } from "@/server/media/images";

const actorOf = (user: SessionUser) => ({ id: user.id, name: user.name });

function uniqueEventSlug(base: string, excludeId: string | null): Promise<string> {
  return uniqueSlug(base || "event", async (candidate) => {
    const hit = await db.event.findUnique({ where: { slug: candidate }, select: { id: true } });
    return Boolean(hit && hit.id !== excludeId);
  });
}

/** JSON with object keys sorted, because Postgres jsonb reorders keys on storage. */
function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null, (_k, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const norm = (v: unknown) => (v instanceof Date ? v.getTime() : stableJson(v));
  return Object.keys(after).filter((k) => k !== "updatedById" && norm(before[k]) !== norm(after[k]));
}

function eventTags(...slugs: (string | null | undefined)[]): CacheTag[] {
  return [TAGS.events, ...slugs.filter((s): s is string => !!s).map((s) => `event:${s}` as const)];
}

export async function saveEventAction(
  _prev: ActionResult<{ id: string; slug: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string; slug: string }>> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const raw = formDataToObject(formData, EVENT_JSON_KEYS);
    const id = typeof raw.id === "string" && raw.id ? raw.id : null;
    const user = await requirePermission(id ? "events.edit" : "events.create");
    const input = eventFormSchema.parse(raw);
    const existing = id ? await db.event.findUnique({ where: { id } }) : null;
    if (id && !existing) throw new UserError("That event no longer exists.");

    const { timezone } = await loadSiteSettings();
    const slug = await uniqueEventSlug(slugify(input.slug || input.title), id);
    const data = {
      title: input.title,
      slug,
      tagline: input.tagline,
      description: sanitizeRichText(input.description),
      posterId: input.posterId,
      categoryId: input.categoryId,
      startAt: zonedToUtc(input.startAt, timezone),
      endAt: zonedToUtc(input.endAt, timezone),
      venue: input.venue,
      mode: input.mode,
      onlineUrl: input.onlineUrl,
      registrationMode: input.registrationMode,
      externalRegistrationUrl: input.registrationMode === "EXTERNAL" ? input.externalRegistrationUrl : null,
      registrationDeadline: input.registrationDeadline ? zonedToUtc(input.registrationDeadline, timezone) : null,
      maxParticipants: input.maxParticipants,
      eligibility: input.eligibility,
      organizers: input.organizers,
      contacts: input.contacts,
      links: input.links,
      showCountdown: input.showCountdown,
      countdownTarget: input.countdownTarget,
      featured: input.featured,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      updatedById: user.id,
    } satisfies Prisma.EventUncheckedUpdateInput;

    const sponsors = [...new Map(input.sponsors.map((s) => [s.sponsorId, s])).values()];
    const meta = await getRequestMeta();
    const saved = await db.$transaction(async (tx) => {
      await ensureImages(tx, [input.posterId]);
      if (input.categoryId && !(await tx.eventCategory.findUnique({ where: { id: input.categoryId } }))) {
        throw new UserError("That category was removed. Pick another.", { categoryId: ["That category was removed. Pick another."] });
      }
      if (sponsors.length && (await tx.sponsor.count({ where: { id: { in: sponsors.map((s) => s.sponsorId) } } })) !== sponsors.length) {
        throw new UserError("One of the sponsors was removed. Pick it again.");
      }
      const event = existing
        ? await tx.event.update({ where: { id: existing.id }, data })
        : await tx.event.create({ data: { ...data, createdById: user.id } });
      await tx.eventSponsor.deleteMany({ where: { eventId: event.id } });
      if (sponsors.length) {
        await tx.eventSponsor.createMany({
          data: sponsors.map((s, order) => ({ eventId: event.id, sponsorId: s.sponsorId, type: s.type, customLabel: s.customLabel || null, order })),
        });
      }
      await updateImageAlt(tx, input.posterId, formData.get("posterIdAlt"));
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: existing ? "event.updated" : "event.created",
        target: { type: "Event", id: event.id, label: event.title },
        metadata: existing ? { changed: changedKeys(existing as unknown as Record<string, unknown>, data) } : {},
        meta,
      });
      return event;
    });

    invalidate(...eventTags(saved.slug, existing?.slug !== saved.slug ? existing?.slug : null));
    revalidatePath("/admin/events");
    if (!existing) createdId = saved.id;
    return { id: saved.id, slug: saved.slug };
  });
  if (createdId) redirect(`/admin/events/${createdId}?created=1`);
  return result;
}

export async function duplicateEventAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let newId: string | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("events.create");
    const source = await db.event.findUnique({ where: { id: String(formData.get("id") ?? "") }, include: { sponsors: true } });
    if (!source) throw new UserError("That event no longer exists.");
    const slug = await uniqueEventSlug(slugify(`${source.title} copy`), null);
    const meta = await getRequestMeta();
    newId = await db.$transaction(async (tx) => {
      const { id: _id, createdAt: _c, updatedAt: _u, publishedAt: _p, sponsors, ...fields } = source;
      const copy = await tx.event.create({
        data: {
          ...(fields as Prisma.EventUncheckedCreateInput),
          organizers: source.organizers as Prisma.InputJsonValue,
          contacts: source.contacts as Prisma.InputJsonValue,
          links: source.links as Prisma.InputJsonValue,
          title: `${source.title} (copy)`,
          slug,
          lifecycle: "DRAFT",
          featured: false,
          createdById: user.id,
          updatedById: user.id,
        },
      });
      if (sponsors.length) {
        await tx.eventSponsor.createMany({
          data: sponsors.map((s) => ({ eventId: copy.id, sponsorId: s.sponsorId, type: s.type, customLabel: s.customLabel, order: s.order })),
        });
      }
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: "event.duplicated",
        target: { type: "Event", id: copy.id, label: copy.title },
        metadata: { from: source.title },
        meta,
      });
      return copy.id;
    });
    revalidatePath("/admin/events");
    return null;
  });
  if (newId) redirect(`/admin/events/${newId}?duplicated=1`);
  return result;
}

export async function setEventLifecycleAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("events.publish");
    const event = await db.event.findUnique({ where: { id: String(formData.get("id") ?? "") } });
    if (!event) throw new UserError("That event no longer exists.");
    const to = String(formData.get("to") ?? "") as Lifecycle;
    if (!canTransition(event.lifecycle, to)) throw new UserError("That change isn't possible from the event's current state.");
    if (to === "PUBLISHED" && !event.description.trim()) {
      throw new UserError("Add a description before publishing, so visitors know what the event is about.");
    }
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.event.update({
        where: { id: event.id },
        data: { lifecycle: to, publishedAt: to === "PUBLISHED" ? (event.publishedAt ?? new Date()) : event.publishedAt, updatedById: user.id },
      });
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: transitionAction(event.lifecycle, to),
        target: { type: "Event", id: event.id, label: event.title },
        metadata: { from: event.lifecycle, to },
        meta,
      });
    });
    invalidate(...eventTags(event.slug));
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${event.id}`);
    return null;
  });
}

export async function deleteEventAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("events.delete");
    const event = await db.event.findUnique({ where: { id: String(formData.get("id") ?? "") } });
    if (!event) throw new UserError("That event no longer exists.");
    if (event.lifecycle === "PUBLISHED") throw new UserError("Unpublish or archive the event before deleting it.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.event.delete({ where: { id: event.id } });
      await writeAuditLog(tx, {
        actor: actorOf(user),
        action: "event.deleted",
        target: { type: "Event", id: event.id, label: event.title },
        metadata: { slug: event.slug },
        meta,
      });
    });
    invalidate(...eventTags(event.slug));
    return null;
  });
  if (result.ok) redirect("/admin/events?deleted=1");
  return result;
}
