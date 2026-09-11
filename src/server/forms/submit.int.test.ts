import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { field, options, page, registrationForm } from "@/lib/forms/engine/test-fixtures";

vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { submitFormResponse } = await import("./submit");

const now = new Date("2026-09-15T10:00:00Z");
let ipCounter = 0;
let meta = { ip: "10.9.0.1", userAgent: "vitest" };

async function publishedForm(
  overrides: Partial<Omit<Prisma.FormUncheckedCreateInput, "name" | "slug" | "draftDefinition">> = {},
  definition: unknown = registrationForm(),
) {
  const form = await db.form.create({
    data: { name: "Recruitment", slug: `f-${Math.random().toString(36).slice(2, 8)}`, draftDefinition: definition as Prisma.InputJsonValue, ...overrides },
  });
  const version = await db.formVersion.create({ data: { formId: form.id, version: 1, definition: definition as Prisma.InputJsonValue } });
  return db.form.update({ where: { id: form.id }, data: { publishedVersionId: version.id }, include: { publishedVersion: true } });
}

const validAnswers = { year: "y2", domain: "design", portfolio: "https://dribbble.com/me", experience: "Built things", email: "Priya@Example.edu", consent: "yes" };

function submit(form: { slug: string; publishedVersionId: string | null }, answers: Record<string, unknown> = validAnswers, extra: Record<string, unknown> = {}) {
  return submitFormResponse({
    slug: form.slug,
    versionId: form.publishedVersionId!,
    answers: answers as never,
    startedAt: now.getTime() - 60_000,
    honeypot: "",
    meta,
    now,
    ...extra,
  });
}

beforeEach(() => {
  ipCounter += 1;
  meta = { ip: `10.9.0.${ipCounter}`, userAgent: "vitest" };
});

describe("submitFormResponse", () => {
  it("stores the cleaned answers, email, search text, path and daily count", async () => {
    const form = await publishedForm();
    const result = await submit(form, { ...validAnswers, stack: ["figma", "react"], hidden: "x" });
    expect(result).toMatchObject({ ok: true, message: "Thanks! Your response has been recorded." });
    const response = await db.formResponse.findFirstOrThrow();
    expect(response.data).toEqual({ year: "y2", domain: "design", stack: ["figma"], portfolio: "https://dribbble.com/me", experience: "Built things", email: "priya@example.edu", consent: "yes" });
    expect(response.email).toBe("priya@example.edu");
    expect(response.searchText).toContain("design");
    expect(response.pagePath).toEqual(["about", "experience", "contact"]);
    expect(response.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await db.formDailyStat.findFirstOrThrow()).submissions).toBe(1);
  });

  it("returns field errors for invalid answers", async () => {
    const form = await publishedForm();
    const result = await submit(form, { year: "y2", domain: "dev", email: "nope" });
    expect(result).toMatchObject({ ok: false, status: 400, fieldErrors: { experience: "This question is required.", email: "Enter a valid email address." } });
  });

  it("refuses stale versions, closed forms and EVENT_ONLY forms without an event", async () => {
    const form = await publishedForm();
    expect(await submit({ ...form, publishedVersionId: "old" })).toMatchObject({ ok: false, status: 409 });
    expect(await submit(await publishedForm({ acceptingResponses: false }))).toMatchObject({ ok: false, error: "This form isn't accepting responses right now." });
    expect(await submit(await publishedForm({ closesAt: new Date(now.getTime() - 1000) }))).toMatchObject({ ok: false, error: "This form has closed." });
    expect(await submit(await publishedForm({ opensAt: new Date(now.getTime() + 1000) }))).toMatchObject({ ok: false, error: "This form isn't open yet." });
    expect(await submit(await publishedForm({ visibility: "EVENT_ONLY" }))).toMatchObject({ ok: false, status: 404 });
    expect(await db.formResponse.count()).toBe(0);
  });

  it("drops honeypot submissions quietly and rejects instant ones", async () => {
    const form = await publishedForm();
    expect(await submit(form, validAnswers, { honeypot: "http://spam" })).toMatchObject({ ok: true, responseId: null });
    expect(await submit(form, validAnswers, { startedAt: now.getTime() - 500 })).toMatchObject({ ok: false, status: 429 });
    expect(await db.formResponse.count()).toBe(0);
  });

  it("enforces the response limit and one response per email", async () => {
    const capped = await publishedForm({ maxResponses: 1 });
    expect((await submit(capped)).ok).toBe(true);
    expect(await submit(capped, { ...validAnswers, email: "other@example.edu" })).toMatchObject({ ok: false, error: "All spots are taken. Registrations are closed." });

    const once = await publishedForm({ oneResponsePerEmail: true });
    expect((await submit(once)).ok).toBe(true);
    expect(await submit(once, { ...validAnswers, email: "PRIYA@example.edu" })).toMatchObject({ ok: false, error: "You've already responded with this email address." });
  });

  it("applies event registration rules and links the response to the event", async () => {
    const form = await publishedForm({ visibility: "EVENT_ONLY" });
    const event = await db.event.create({
      data: {
        slug: `sprint-${ipCounter}`, title: "Code Sprint", lifecycle: "PUBLISHED", registrationMode: "FORM", formId: form.id, maxParticipants: 1,
        startAt: new Date(now.getTime() + 86_400_000), endAt: new Date(now.getTime() + 90_000_000),
      },
    });
    expect((await submit(form, validAnswers, { eventSlug: event.slug })).ok).toBe(true);
    expect((await db.formResponse.findFirstOrThrow()).eventId).toBe(event.id);
    expect(await submit(form, { ...validAnswers, email: "b@example.edu" }, { eventSlug: event.slug })).toMatchObject({ ok: false, error: "All seats are taken." });

    await db.event.update({ where: { id: event.id }, data: { maxParticipants: null, registrationDeadline: new Date(now.getTime() - 1000) } });
    expect(await submit(form, { ...validAnswers, email: "c@example.edu" }, { eventSlug: event.slug })).toMatchObject({ ok: false, error: "Registration has closed." });

    const otherEvent = await db.event.create({ data: { slug: `other-${ipCounter}`, title: "Other", lifecycle: "PUBLISHED", startAt: now, endAt: now, registrationMode: "NONE" } });
    expect(await submit(form, validAnswers, { eventSlug: otherEvent.slug })).toMatchObject({ ok: false, status: 404 });
  });

  it("claims fresh uploads and refuses expired ones", async () => {
    const def = { pages: [page("p", [field("name", "short_text", { required: true }), field("cv", "file", { validation: { maxFiles: 1 } })])] };
    const form = await publishedForm({}, def);
    const fresh = await db.upload.create({ data: { kind: "FILE", purpose: "FORM_FILE", visibility: "PRIVATE", originalName: "cv.pdf", mimeType: "application/pdf", sizeBytes: 10, storageKey: `k-${ipCounter}-a`, createdAt: now } });
    const stale = await db.upload.create({
      data: { kind: "FILE", purpose: "FORM_FILE", visibility: "PRIVATE", originalName: "old.pdf", mimeType: "application/pdf", sizeBytes: 10, storageKey: `k-${ipCounter}-b`, createdAt: new Date(now.getTime() - 2 * 86_400_000) },
    });
    expect((await submit(form, { name: "A", cv: [fresh.id] })).ok).toBe(true);
    expect((await db.upload.findUniqueOrThrow({ where: { id: fresh.id } })).formResponseId).not.toBeNull();
    expect(await submit(form, { name: "B", cv: [stale.id] })).toMatchObject({ ok: false, error: "One of your uploads expired. Upload it again." });
    expect(await submit(form, { name: "C", cv: [fresh.id] })).toMatchObject({ ok: false, error: "One of your uploads expired. Upload it again." });
    expect(await db.formResponse.count()).toBe(1);
  });

  it("keeps question types honest", async () => {
    const form = await publishedForm({}, { pages: [page("p", [field("pick", "radio", { required: true, options: options("a", "b") })])] });
    expect(await submit(form, { pick: "zzz" })).toMatchObject({ ok: false, fieldErrors: { pick: "Choose one of the options." } });
  });
});
