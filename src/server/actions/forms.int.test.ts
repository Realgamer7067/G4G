import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { cond, field, page, registrationForm, when } from "@/lib/forms/engine/test-fixtures";
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

const { createFormAction, saveFormDraftAction, publishFormAction, saveFormSettingsAction, deleteFormAction, deleteResponsesAction } =
  await import("./forms");

async function makeForm(definition: unknown = registrationForm()) {
  return db.form.create({ data: { name: "Web team recruitment", slug: `web-${Math.random().toString(36).slice(2, 8)}`, draftDefinition: definition as Prisma.InputJsonValue } });
}

beforeEach(() => resetMockRequest());

describe("createFormAction", () => {
  it("requires forms.create", async () => {
    await signIn({ permissions: ["forms.edit"] });
    expect(await createFormAction(undefined, formOf({ name: "Join us" }))).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("creates a form with a starter page and opens the builder", async () => {
    await signIn({ permissions: ["forms.create"] });
    await expect(createFormAction(undefined, formOf({ name: "Web Team Recruitment" }))).rejects.toThrow(/REDIRECT:\/admin\/forms\/.+\/build\?created=1/);
    const form = await db.form.findFirstOrThrow();
    expect(form).toMatchObject({ name: "Web Team Recruitment", slug: "web-team-recruitment", publishedVersionId: null });
    expect((form.draftDefinition as { pages: unknown[] }).pages).toHaveLength(1);
    expect(await db.auditLog.count({ where: { action: "form.created" } })).toBe(1);
  });
});

describe("drafts and publishing", () => {
  it("autosaves a draft and reports logic problems without blocking", async () => {
    await signIn({ permissions: ["forms.edit"] });
    const form = await makeForm();
    const broken = { pages: [page("a", [field("x", "short_text", { visibleWhen: when("all", cond("y", "is_filled")) }), field("y", "short_text")])] };
    const result = await saveFormDraftAction(form.id, broken);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.issues[0]?.message).toContain("comes later");
    // JSON storage drops `undefined` keys, so compare with the round-tripped definition.
    expect(await db.form.findUniqueOrThrow({ where: { id: form.id } })).toMatchObject({ draftDefinition: JSON.parse(JSON.stringify(broken)), hasUnpublishedChanges: true });
  });

  it("refuses to save a malformed draft", async () => {
    await signIn({ permissions: ["forms.edit"] });
    const form = await makeForm();
    const result = await saveFormDraftAction(form.id, { pages: [page("a", [field("x", "short_text", { label: "" })])] });
    expect(result).toEqual({ ok: false, error: "Not saved yet. Every question and option needs a label." });
  });

  it("blocks publishing with issues, then publishes numbered versions", async () => {
    await signIn({ permissions: ["forms.edit"] });
    const form = await makeForm({ pages: [page("a", [field("x", "radio", { options: [] })])] });
    const blocked = await publishFormAction(form.id);
    expect(blocked).toMatchObject({ ok: false, error: "Fix the issues listed before publishing." });
    if (!blocked.ok) expect(Object.values(blocked.fieldErrors ?? {}).flat()[0]).toContain("needs at least one option");

    await db.form.update({ where: { id: form.id }, data: { draftDefinition: registrationForm() as unknown as Prisma.InputJsonValue } });
    expect(await publishFormAction(form.id)).toEqual({ ok: true, data: { version: 1 } });
    expect(await publishFormAction(form.id)).toEqual({ ok: true, data: { version: 2 } });
    const after = await db.form.findUniqueOrThrow({ where: { id: form.id }, include: { publishedVersion: true } });
    expect(after).toMatchObject({ hasUnpublishedChanges: false, publishedVersion: { version: 2 } });
    expect(await db.auditLog.count({ where: { action: "form.published" } })).toBe(2);
  });

  it("requires forms.edit to publish", async () => {
    await signIn({ permissions: ["forms.create"] });
    const form = await makeForm();
    expect(await publishFormAction(form.id)).toEqual({ ok: false, error: "You don't have permission to do that." });
  });
});

describe("settings", () => {
  it("saves settings with times in the site zone and validates the window", async () => {
    await signIn({ permissions: ["forms.edit"] });
    const form = await makeForm();
    const base = { id: form.id, name: "Recruitment", successMessage: "Thanks!", submitLabel: "Apply", visibility: "PUBLIC_LINK", acceptingResponses: "on" };
    expect(await saveFormSettingsAction(undefined, formOf({ ...base, opensAt: "2026-10-02T10:00", closesAt: "2026-10-01T10:00" }))).toMatchObject({
      ok: false,
      fieldErrors: { closesAt: ["The closing time must be after the opening time."] },
    });
    expect(await saveFormSettingsAction(undefined, formOf({ ...base, closesAt: "2026-10-01T18:00", maxResponses: "50", oneResponsePerEmail: "on" }))).toEqual({
      ok: true,
      data: null,
    });
    const saved = await db.form.findUniqueOrThrow({ where: { id: form.id } });
    expect(saved).toMatchObject({ name: "Recruitment", slug: "recruitment", maxResponses: 50, oneResponsePerEmail: true, reviewStep: false, submitLabel: "Apply" });
    expect(saved.closesAt?.toISOString()).toBe("2026-10-01T12:30:00.000Z");
  });
});

describe("deleting", () => {
  it("won't delete a form an event uses for registration", async () => {
    await signIn({ permissions: ["forms.delete"] });
    const form = await makeForm();
    await db.event.create({ data: { slug: "e", title: "Code Sprint", startAt: new Date(), endAt: new Date(Date.now() + 3600_000), registrationMode: "FORM", formId: form.id } });
    expect(await deleteFormAction(undefined, formOf({ id: form.id }))).toEqual({
      ok: false,
      error: "This form is the registration form for “Code Sprint”. Change those events first.",
    });
  });

  it("deletes a form with its responses", async () => {
    await signIn({ permissions: ["forms.delete"] });
    const form = await makeForm();
    const version = await db.formVersion.create({ data: { formId: form.id, version: 1, definition: {} } });
    await db.formResponse.create({ data: { formId: form.id, versionId: version.id, data: {} } });
    await expect(deleteFormAction(undefined, formOf({ id: form.id }))).rejects.toThrow("REDIRECT:/admin/forms?deleted=1");
    expect(await db.formResponse.count()).toBe(0);
  });

  it("deletes only the selected responses of the given form", async () => {
    await signIn({ permissions: ["forms.responses.view"] });
    const form = await makeForm();
    const other = await makeForm();
    const v1 = await db.formVersion.create({ data: { formId: form.id, version: 1, definition: {} } });
    const v2 = await db.formVersion.create({ data: { formId: other.id, version: 1, definition: {} } });
    const mine = await db.formResponse.create({ data: { formId: form.id, versionId: v1.id, data: {} } });
    const theirs = await db.formResponse.create({ data: { formId: other.id, versionId: v2.id, data: {} } });
    expect(await deleteResponsesAction(undefined, formOf({ formId: form.id, ids: [mine.id, theirs.id] }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });

    await signIn({ permissions: ["forms.responses.delete"] });
    expect(await deleteResponsesAction(undefined, formOf({ formId: form.id, ids: [mine.id, theirs.id] }))).toEqual({ ok: true, data: { deleted: 1 } });
    expect(await db.formResponse.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });
});
