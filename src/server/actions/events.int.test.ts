import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { saveEventAction, setEventLifecycleAction, duplicateEventAction, deleteEventAction } = await import("./events");

function eventForm(overrides: Record<string, string> = {}) {
  return formOf({
    title: "Code Sprint 2026",
    tagline: "24 hours of building",
    description: "<p>Build <strong>anything</strong>.</p><script>alert(1)</script>",
    startAt: "2026-10-03T09:00",
    endAt: "2026-10-03T17:00",
    venue: "Main Auditorium",
    mode: "OFFLINE",
    registrationMode: "NONE",
    organizers: "[]",
    contacts: "[]",
    links: JSON.stringify([{ label: "Rules", url: "https://example.edu/rules" }]),
    sponsors: "[]",
    ...overrides,
  });
}

async function createEvent(overrides: Record<string, string> = {}) {
  const error = await saveEventAction(undefined, eventForm(overrides)).catch((e: Error) => e);
  const match = /REDIRECT:\/admin\/events\/([^?]+)\?created=1/.exec(String((error as Error).message));
  if (!match) throw new Error(`expected redirect, got ${JSON.stringify(error)}`);
  return db.event.findUniqueOrThrow({ where: { id: match[1] }, include: { sponsors: true } });
}

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("saveEventAction", () => {
  it("requires events.create for new events", async () => {
    await signIn({ permissions: ["events.edit"] });
    expect(await saveEventAction(undefined, eventForm())).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("creates a sanitised draft with times converted from the site time zone", async () => {
    const { admin } = await signIn({ permissions: ["events.create", "events.edit"] });
    const sponsor = await db.sponsor.create({ data: { name: "ACME Cloud" } });
    const event = await createEvent({ sponsors: JSON.stringify([{ sponsorId: sponsor.id, type: "POWERED_BY", customLabel: "" }]) });

    expect(event).toMatchObject({ slug: "code-sprint-2026", lifecycle: "DRAFT", createdById: admin.id, registrationMode: "NONE" });
    expect(event.startAt.toISOString()).toBe("2026-10-03T03:30:00.000Z");
    expect(event.description).toBe("<p>Build <strong>anything</strong>.</p>");
    expect(event.sponsors).toMatchObject([{ sponsorId: sponsor.id, type: "POWERED_BY", order: 0 }]);
    expect(await db.auditLog.count({ where: { action: "event.created" } })).toBe(1);
    expect(cache.revalidateTag).toHaveBeenCalledWith("events", { expire: 0 });
  });

  it("gives duplicate titles a unique slug", async () => {
    await signIn({ permissions: ["events.create"] });
    await createEvent();
    expect((await createEvent()).slug).toBe("code-sprint-2026-2");
  });

  it("validates dates and the external registration link", async () => {
    await signIn({ permissions: ["events.create"] });
    const backwards = await saveEventAction(undefined, eventForm({ endAt: "2026-10-03T08:00" }));
    expect(backwards).toMatchObject({ ok: false, fieldErrors: { endAt: ["The event must end after it starts."] } });
    const external = await saveEventAction(undefined, eventForm({ registrationMode: "EXTERNAL" }));
    expect(external).toMatchObject({ ok: false, fieldErrors: { externalRegistrationUrl: ["Add the registration link."] } });
  });

  it("updates an event and records what changed", async () => {
    await signIn({ permissions: ["events.create", "events.edit"] });
    const event = await createEvent();
    const result = await saveEventAction(undefined, eventForm({ id: event.id, slug: event.slug, venue: "Block C" }));
    expect(result).toMatchObject({ ok: true, data: { id: event.id, slug: "code-sprint-2026" } });
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "event.updated" } });
    expect(log.metadata).toMatchObject({ changed: ["venue"] });
  });
});

describe("lifecycle", () => {
  it("requires events.publish and a description, then publishes", async () => {
    await signIn({ permissions: ["events.create"] });
    const event = await createEvent({ description: "" });
    expect(await setEventLifecycleAction(undefined, formOf({ id: event.id, to: "PUBLISHED" }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });

    await signIn({ permissions: ["events.publish", "events.edit"] });
    expect(await setEventLifecycleAction(undefined, formOf({ id: event.id, to: "PUBLISHED" }))).toMatchObject({
      ok: false,
      error: "Add a description before publishing, so visitors know what the event is about.",
    });
    await db.event.update({ where: { id: event.id }, data: { description: "<p>Hi</p>" } });
    expect(await setEventLifecycleAction(undefined, formOf({ id: event.id, to: "PUBLISHED" }))).toEqual({ ok: true, data: null });
    const published = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(published.lifecycle).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "event.published" } })).toBe(1);
  });

  it("refuses impossible transitions", async () => {
    await signIn({ permissions: ["events.create", "events.publish"] });
    const event = await createEvent();
    expect(await setEventLifecycleAction(undefined, formOf({ id: event.id, to: "CANCELLED" }))).toEqual({
      ok: false,
      error: "That change isn't possible from the event's current state.",
    });
  });
});

describe("duplicate and delete", () => {
  it("duplicates as a draft with sponsors", async () => {
    await signIn({ permissions: ["events.create"] });
    const sponsor = await db.sponsor.create({ data: { name: "DevHub" } });
    const event = await createEvent({ sponsors: JSON.stringify([{ sponsorId: sponsor.id, type: "TITLE", customLabel: "" }]) });
    await db.event.update({ where: { id: event.id }, data: { lifecycle: "PUBLISHED" } });

    const error = await duplicateEventAction(undefined, formOf({ id: event.id })).catch((e: Error) => e);
    const copyId = /REDIRECT:\/admin\/events\/([^?]+)\?duplicated=1/.exec(String((error as Error).message))?.[1];
    const copy = await db.event.findUniqueOrThrow({ where: { id: copyId }, include: { sponsors: true } });
    expect(copy).toMatchObject({ title: "Code Sprint 2026 (copy)", slug: "code-sprint-2026-copy", lifecycle: "DRAFT", publishedAt: null });
    expect(copy.sponsors).toHaveLength(1);
  });

  it("won't delete a published event and needs events.delete", async () => {
    await signIn({ permissions: ["events.create", "events.delete"] });
    const event = await createEvent();
    await db.event.update({ where: { id: event.id }, data: { lifecycle: "PUBLISHED" } });
    expect(await deleteEventAction(undefined, formOf({ id: event.id }))).toEqual({
      ok: false,
      error: "Unpublish or archive the event before deleting it.",
    });
    await db.event.update({ where: { id: event.id }, data: { lifecycle: "ARCHIVED" } });
    await expect(deleteEventAction(undefined, formOf({ id: event.id }))).rejects.toThrow("REDIRECT:/admin/events?deleted=1");
    expect(await db.event.count()).toBe(0);

    await signIn({ permissions: ["events.create"] });
    const other = await createEvent();
    expect(await deleteEventAction(undefined, formOf({ id: other.id }))).toEqual({ ok: false, error: "You don't have permission to do that." });
  });
});
