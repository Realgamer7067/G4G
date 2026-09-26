# Phase 5a — Announcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Announcements feature end to end — pure visibility/banner logic, admin CRUD with publish/unpublish, public list + detail pages, the site-wide dismissible banner, and wiring into the homepage, nav, dashboard, sitemap and audit log.

**Architecture:** A pure `src/lib/announcements/visibility.ts` module (TDD) decides what's visible and which announcement wins the banner slot. `src/server/actions/announcements.ts` holds the Server Actions (create/update/delete/publish/unpublish), each `requirePermission("announcements.manage")`, Zod-validated, audit-logged in one transaction, then invalidating `TAGS.announcements` + `TAGS.homepage`. `src/lib/data/announcements.ts` is a tag+time cached read layer (`unstable_cache`, `revalidate: 60`) that public pages, the homepage section and the banner all read through. Admin screens follow the existing sponsors/events CRUD pattern exactly.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind v4 + Prisma 7 + PostgreSQL + Zod 4 + Vitest. Rich text via the existing Tiptap `RichTextEditor` + `sanitize-html`.

**Spec:** `docs/superpowers/specs/2026-09-10-gfg-chapter-platform-design.md` (§5 Announcement model, §9 page toggles, §10 SEO, §11 security, §12 a11y/perf, §13 testing, §14 routes, §16 dashboard).

## Global Constraints

- Next.js 16.3.4 / React 19.3 / Tailwind v4.3 / Zod 4 / Prisma & `@prisma/client` & `@prisma/adapter-pg` pinned to exactly 7.10.0 — never install unpinned.
- `AGENTS.md` at the repo root: this Next.js build has breaking API changes from training data. Any new Next API used here (`PageProps<...>`, `LayoutProps<...>`, `unstable_cache`, route handlers) must already appear elsewhere in this codebase before we copy it — verified per task below.
- Rich text is sanitized with the shared `sanitize-html` allowlist **on write and again on render** (`src/lib/content/sanitize.ts`); links restricted to http/https/mailto with `rel="noopener noreferrer"`.
- Every Server Action starts with `requirePermission("announcements.manage")`; every admin page starts with `requirePagePermission("announcements.manage")`. The permission key already exists in `src/lib/rbac/permissions.ts:16`.
- Zod validates every input; unchecked HTML checkboxes are absent from `FormData` — coerce with `isChecked()` from `src/lib/forms-data.ts` before parsing, never rely on a schema default.
- Public pages call `assertPageEnabled("ANNOUNCEMENTS")` first; the page toggle (`PageSetting` row `ANNOUNCEMENTS`) and its route (`/announcements`) already exist in `src/lib/pages/registry.ts` — only `IMPLEMENTED_PAGES` needs the key added.
- Cache invalidation: mutations call `invalidate(TAGS.announcements, TAGS.homepage)` (both tags already exist in `src/lib/cache-tags.ts`) since the homepage `announcements` section depends on the same data.
- Audit-log action strings must have a matching entry in `src/lib/audit-labels.ts`.
- Numeric inputs (none in this form) would need guards per house rules; this feature has no numeric fields, so N/A.
- Text split on newlines must use `/\r?\n/` (not used in this feature — no multi-line-to-array parsing here).
- `react/no-unescaped-entities` — use `&apos;` in JSX text. `react-hooks/set-state-in-effect` — state is only set inside `useEffect` callbacks (permitted), never synchronously during render.
- Shared files (`nav-items.ts`, `quick-actions.ts`, `audit-labels.ts`, `registry.ts`, `sitemap.ts`, dashboard `page.tsx`) get additive, anchored edits only — sibling plans 5b/5c touch the same files afterward.
- Do not touch team or gallery code.

---

## Task 1: Pure visibility & banner-selection logic (TDD)

**Files:**
- Create: `src/lib/announcements/visibility.ts`
- Test: `src/lib/announcements/visibility.test.ts`

**Interfaces:**
- Produces: `isAnnouncementVisible(a: AnnouncementVisibilityInput, now: Date): boolean`, `selectBannerAnnouncement<T extends BannerCandidate>(rows: readonly T[], now: Date): T | null`, `dismissalKey(a: { id: string; updatedAt: Date | string }): string`, types `AnnouncementVisibilityInput`, `AnnouncementPriority`, `BannerCandidate`. Task 5 (data loader) and Task 11 (banner component) consume these by exact name.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/announcements/visibility.test.ts
import { describe, expect, it } from "vitest";
import { dismissalKey, isAnnouncementVisible, selectBannerAnnouncement, type BannerCandidate } from "./visibility";

const now = new Date("2026-09-26T12:00:00Z");
const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("isAnnouncementVisible", () => {
  it("is visible when published, publishAt has passed and there's no expiry", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(-1), expiresAt: null }, now)).toBe(true);
  });

  it("is hidden while still a draft", () => {
    expect(isAnnouncementVisible({ status: "DRAFT", publishAt: hoursFromNow(-1), expiresAt: null }, now)).toBe(false);
  });

  it("is hidden before publishAt", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(1), expiresAt: null }, now)).toBe(false);
  });

  it("is visible exactly at publishAt", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: now, expiresAt: null }, now)).toBe(true);
  });

  it("is hidden once expiresAt has passed", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(-2), expiresAt: hoursFromNow(-1) }, now)).toBe(false);
  });

  it("is hidden exactly at expiresAt and visible right before it", () => {
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(-2), expiresAt: now }, now)).toBe(false);
    expect(isAnnouncementVisible({ status: "PUBLISHED", publishAt: hoursFromNow(-2), expiresAt: hoursFromNow(1) }, now)).toBe(true);
  });
});

const banner = (over: Partial<BannerCandidate>): BannerCandidate => ({
  id: "a",
  status: "PUBLISHED",
  publishAt: hoursFromNow(-1),
  expiresAt: null,
  showAsBanner: true,
  priority: "NORMAL",
  updatedAt: now,
  ...over,
});

describe("selectBannerAnnouncement", () => {
  it("returns null when nothing is eligible", () => {
    expect(selectBannerAnnouncement([], now)).toBeNull();
    expect(selectBannerAnnouncement([banner({ showAsBanner: false })], now)).toBeNull();
    expect(selectBannerAnnouncement([banner({ status: "DRAFT" })], now)).toBeNull();
  });

  it("picks the highest priority among eligible banners", () => {
    const rows = [banner({ id: "normal", priority: "NORMAL" }), banner({ id: "urgent", priority: "URGENT" }), banner({ id: "important", priority: "IMPORTANT" })];
    expect(selectBannerAnnouncement(rows, now)?.id).toBe("urgent");
  });

  it("breaks ties on the most recently published", () => {
    const rows = [banner({ id: "older", priority: "IMPORTANT", publishAt: hoursFromNow(-5) }), banner({ id: "newer", priority: "IMPORTANT", publishAt: hoursFromNow(-1) })];
    expect(selectBannerAnnouncement(rows, now)?.id).toBe("newer");
  });

  it("ignores banners outside their visibility window", () => {
    const rows = [banner({ id: "expired", priority: "URGENT", expiresAt: hoursFromNow(-1) }), banner({ id: "live", priority: "NORMAL" })];
    expect(selectBannerAnnouncement(rows, now)?.id).toBe("live");
  });
});

describe("dismissalKey", () => {
  it("combines id and updatedAt so an edit re-shows a dismissed banner", () => {
    const a = { id: "x1", updatedAt: new Date("2026-01-01T00:00:00Z") };
    expect(dismissalKey(a)).toBe("x1:2026-01-01T00:00:00.000Z");
    expect(dismissalKey({ ...a, updatedAt: new Date("2026-02-01T00:00:00Z") })).not.toBe(dismissalKey(a));
  });

  it("accepts an already-serialised ISO string, for use in client components", () => {
    expect(dismissalKey({ id: "x1", updatedAt: "2026-01-01T00:00:00.000Z" })).toBe("x1:2026-01-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/announcements/visibility.test.ts`
Expected: FAIL — `Cannot find module './visibility'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/announcements/visibility.ts

export type AnnouncementVisibilityInput = {
  status: "DRAFT" | "PUBLISHED";
  publishAt: Date;
  expiresAt: Date | null;
};

/** PUBLISHED ∧ publishAt ≤ now ∧ (expiresAt null ∨ now < expiresAt). */
export function isAnnouncementVisible(a: AnnouncementVisibilityInput, now: Date): boolean {
  return a.status === "PUBLISHED" && a.publishAt <= now && (a.expiresAt === null || now < a.expiresAt);
}

export type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "URGENT";

export type BannerCandidate = AnnouncementVisibilityInput & {
  id: string;
  priority: AnnouncementPriority;
  showAsBanner: boolean;
  updatedAt: Date;
};

const PRIORITY_RANK: Record<AnnouncementPriority, number> = { URGENT: 3, IMPORTANT: 2, NORMAL: 1 };

/** Highest-priority visible banner announcement; ties broken by the most recently published. */
export function selectBannerAnnouncement<T extends BannerCandidate>(rows: readonly T[], now: Date): T | null {
  const eligible = rows.filter((a) => a.showAsBanner && isAnnouncementVisible(a, now));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, a) =>
    PRIORITY_RANK[a.priority] > PRIORITY_RANK[best.priority] || (PRIORITY_RANK[a.priority] === PRIORITY_RANK[best.priority] && a.publishAt > best.publishAt) ? a : best,
  );
}

/** Client-side dismiss key: id + updatedAt, so editing a dismissed announcement re-shows the banner. */
export function dismissalKey(a: { id: string; updatedAt: Date | string }): string {
  const iso = typeof a.updatedAt === "string" ? a.updatedAt : a.updatedAt.toISOString();
  return `${a.id}:${iso}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/announcements/visibility.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/announcements/visibility.ts src/lib/announcements/visibility.test.ts
git commit -m "feat(announcements): add pure visibility and banner-selection logic"
```

---

## Task 2: Zod form schema and shared constants

**Files:**
- Create: `src/lib/announcements/schema.ts`

**Interfaces:**
- Consumes: `isChecked` from `src/lib/forms-data.ts:32`, `isHttpUrl` from `src/lib/settings/schema.ts` (used identically in `src/lib/events/schema.ts:15`), `isLocalDateTime` from `src/lib/utils/timezone.ts:29`.
- Produces: `ANNOUNCEMENT_PRIORITIES: readonly ["NORMAL","IMPORTANT","URGENT"]`, `ANNOUNCEMENT_PRIORITY_LABELS: Record<...,string>`, `announcementFormSchema` (Zod object). Consumed by Task 3 (action), Task 6 (admin list), Task 7 (form component), Task 9/10 (public pages).

- [ ] **Step 1: Write the schema**

```ts
// src/lib/announcements/schema.ts
import { z } from "zod";
import { isChecked } from "@/lib/forms-data";
import { isHttpUrl } from "@/lib/settings/schema";
import { isLocalDateTime } from "@/lib/utils/timezone";

export const ANNOUNCEMENT_PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<(typeof ANNOUNCEMENT_PRIORITIES)[number], string> = {
  NORMAL: "Normal",
  IMPORTANT: "Important",
  URGENT: "Urgent",
};

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const nullableText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => v || null);
const nullableId = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);
const localDateTime = (label: string) =>
  z
    .string({ error: `Pick the ${label}.` })
    .trim()
    .refine((v) => v.includes("T") && isLocalDateTime(v), `Pick the ${label}.`);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || isHttpUrl(v), "Use a full link that starts with https://.");

export const announcementFormSchema = z
  .object({
    id: nullableId,
    title: text(160).min(3, "Give the announcement a title."),
    slug: text(80).optional().default(""),
    summary: text(240).default(""),
    content: z.string().max(20_000, "The content is too long.").default(""),
    publishAt: localDateTime("publish date and time"),
    expiresAt: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || null)
      .refine((v) => v === null || (v.includes("T") && isLocalDateTime(v)), "Pick a date and time."),
    linkUrl: optionalUrl,
    linkLabel: nullableText(40),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).default("NORMAL"),
    pinned: z.unknown().optional().transform(isChecked),
    showOnHomepage: z.unknown().optional().transform(isChecked),
    showAsBanner: z.unknown().optional().transform(isChecked),
  })
  .superRefine((val, ctx) => {
    if (val.expiresAt && val.expiresAt <= val.publishAt) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Must be after the publish date." });
    }
  });

export type AnnouncementFormInput = z.infer<typeof announcementFormSchema>;
```

- [ ] **Step 2: Sanity-check it compiles**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "announcements/schema" || echo "no errors in schema.ts"`
Expected: `no errors in schema.ts` (full project typecheck happens in the final gate; this is a quick spot-check since `next typegen` hasn't run yet for route types elsewhere)

- [ ] **Step 3: Commit**

```bash
git add src/lib/announcements/schema.ts
git commit -m "feat(announcements): add Zod form schema and priority constants"
```

---

## Task 3: Server Actions — create/update and delete

**Files:**
- Create: `src/server/actions/announcements.ts`

**Interfaces:**
- Consumes: `runAction`, `ActionResult` from `src/lib/actions.ts`; `writeAuditLog` from `src/lib/audit.ts`; `requirePermission` from `src/lib/auth/guard.ts:39`; `TAGS`, `invalidate` from `src/lib/cache-tags.ts`; `sanitizeRichText` from `src/lib/content/sanitize.ts:26`; `loadSiteSettings` from `src/lib/data/site.ts:41`; `db` from `src/lib/db.ts`; `UserError` from `src/lib/errors.ts`; `getRequestMeta` from `src/lib/request-meta.ts`; `slugify`, `uniqueSlug` from `src/lib/utils/slug.ts`; `zonedToUtc` from `src/lib/utils/timezone.ts:36`; `announcementFormSchema` from Task 2.
- Produces: `saveAnnouncementAction(prev, formData): Promise<ActionResult<{ id: string }>>`, `deleteAnnouncementAction(prev, formData): Promise<ActionResult>`. Consumed by Task 7 (form component) and Task 4 (int test).

- [ ] **Step 1: Write the action file**

```ts
// src/server/actions/announcements.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { announcementFormSchema } from "@/lib/announcements/schema";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { sanitizeRichText } from "@/lib/content/sanitize";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request-meta";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { zonedToUtc } from "@/lib/utils/timezone";

function uniqueAnnouncementSlug(base: string, excludeId: string | null): Promise<string> {
  return uniqueSlug(base || "announcement", async (candidate) => {
    const hit = await db.announcement.findUnique({ where: { slug: candidate }, select: { id: true } });
    return Boolean(hit && hit.id !== excludeId);
  });
}

export async function saveAnnouncementAction(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("announcements.manage");
    const input = announcementFormSchema.parse(Object.fromEntries(formData));
    const existing = input.id ? await db.announcement.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That announcement no longer exists.");

    const { timezone } = await loadSiteSettings();
    const slug = await uniqueAnnouncementSlug(slugify(input.slug || input.title), input.id);
    const data = {
      title: input.title,
      slug,
      summary: input.summary,
      content: sanitizeRichText(input.content),
      publishAt: zonedToUtc(input.publishAt, timezone),
      expiresAt: input.expiresAt ? zonedToUtc(input.expiresAt, timezone) : null,
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel,
      priority: input.priority,
      pinned: input.pinned,
      showOnHomepage: input.showOnHomepage,
      showAsBanner: input.showAsBanner,
    };

    const meta = await getRequestMeta();
    const saved = await db.$transaction(async (tx) => {
      const row = existing
        ? await tx.announcement.update({ where: { id: existing.id }, data })
        : await tx.announcement.create({ data: { ...data, createdById: user.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "announcement.updated" : "announcement.created",
        target: { type: "Announcement", id: row.id, label: row.title },
        meta,
      });
      return row;
    });

    invalidate(TAGS.announcements, TAGS.homepage);
    revalidatePath("/admin/announcements");
    if (!existing) createdId = saved.id;
    return { id: saved.id };
  });
  if (createdId) redirect(`/admin/announcements/${createdId}?created=1`);
  return result;
}

export async function deleteAnnouncementAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("announcements.manage");
    const announcement = await db.announcement.findUnique({ where: { id: String(formData.get("id") ?? "") } });
    if (!announcement) throw new UserError("That announcement no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.announcement.delete({ where: { id: announcement.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "announcement.deleted",
        target: { type: "Announcement", id: announcement.id, label: announcement.title },
        meta,
      });
    });
    invalidate(TAGS.announcements, TAGS.homepage);
    return null;
  });
  if (result.ok) redirect("/admin/announcements?deleted=1");
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/actions/announcements.ts
git commit -m "feat(announcements): add create/update/delete server actions"
```

---

## Task 4: Server Actions — publish/unpublish + integration tests

**Files:**
- Modify: `src/server/actions/announcements.ts` (append)
- Test: `src/server/actions/announcements.int.test.ts`

**Interfaces:**
- Produces: `setAnnouncementStatusAction(prev, formData): Promise<ActionResult>`. Consumed by Task 8 (status bar component).
- Consumes: `signIn`, `formOf` from `src/test/session.ts`; `resetMockRequest` from `src/test/mocks/state.ts`; mocks from `src/test/mocks/next-headers.ts` and `src/test/mocks/next-cache.ts` — same pattern as `src/server/actions/sponsors.int.test.ts`.

- [ ] **Step 1: Append the status action**

```ts
// append to src/server/actions/announcements.ts, after saveAnnouncementAction and before deleteAnnouncementAction

export async function setAnnouncementStatusAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("announcements.manage");
    const announcement = await db.announcement.findUnique({ where: { id: String(formData.get("id") ?? "") } });
    if (!announcement) throw new UserError("That announcement no longer exists.");
    const to = String(formData.get("to") ?? "");
    if (to !== "DRAFT" && to !== "PUBLISHED") throw new UserError("That change isn't possible.");
    if (to === announcement.status) throw new UserError("That announcement is already in that state.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.announcement.update({ where: { id: announcement.id }, data: { status: to } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: to === "PUBLISHED" ? "announcement.published" : "announcement.unpublished",
        target: { type: "Announcement", id: announcement.id, label: announcement.title },
        meta,
      });
    });
    invalidate(TAGS.announcements, TAGS.homepage);
    revalidatePath("/admin/announcements");
    revalidatePath(`/admin/announcements/${announcement.id}`);
    return null;
  });
}
```

- [ ] **Step 2: Write the integration test**

```ts
// src/server/actions/announcements.int.test.ts
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

const { saveAnnouncementAction, setAnnouncementStatusAction, deleteAnnouncementAction } = await import("./announcements");

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("announcement actions", () => {
  it("require announcements.manage", async () => {
    await signIn({ permissions: ["events.edit"] });
    expect(await saveAnnouncementAction(undefined, formOf({ title: "Hi", publishAt: "2026-01-01T00:00" }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
  });

  it("create, publish, unpublish, update and delete with audit and cache refresh", async () => {
    await signIn({ permissions: ["announcements.manage"] });
    const created = await saveAnnouncementAction(
      undefined,
      formOf({ title: "Registrations open", summary: "Sign up now", publishAt: "2026-01-01T09:00", priority: "URGENT", showOnHomepage: "on", showAsBanner: "on" }),
    ).catch((e: Error) => e);
    const id = /REDIRECT:\/admin\/announcements\/([^?]+)\?created=1/.exec(String((created as Error).message))?.[1];
    const row = await db.announcement.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ title: "Registrations open", status: "DRAFT", priority: "URGENT", showOnHomepage: true, showAsBanner: true });
    expect(row.slug).toBe("registrations-open");

    expect(await setAnnouncementStatusAction(undefined, formOf({ id: id!, to: "PUBLISHED" }))).toEqual({ ok: true, data: null });
    expect((await db.announcement.findUniqueOrThrow({ where: { id } })).status).toBe("PUBLISHED");
    expect(cache.revalidateTag).toHaveBeenCalledWith("announcements", { expire: 0 });

    expect(await setAnnouncementStatusAction(undefined, formOf({ id: id!, to: "PUBLISHED" }))).toMatchObject({ ok: false, error: "That announcement is already in that state." });

    expect(await setAnnouncementStatusAction(undefined, formOf({ id: id!, to: "DRAFT" }))).toEqual({ ok: true, data: null });
    expect((await db.announcement.findUniqueOrThrow({ where: { id } })).status).toBe("DRAFT");

    expect(await saveAnnouncementAction(undefined, formOf({ id: id!, title: "Registrations open", publishAt: "2026-01-01T09:00", priority: "NORMAL" }))).toEqual({
      ok: true,
      data: { id },
    });
    expect((await db.announcement.findUniqueOrThrow({ where: { id } })).priority).toBe("NORMAL");

    await expect(deleteAnnouncementAction(undefined, formOf({ id: id! }))).rejects.toThrow("REDIRECT:/admin/announcements?deleted=1");
    expect(await db.announcement.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: { startsWith: "announcement." } } })).toBe(5);
  });

  it("rejects an expiry before the publish date", async () => {
    await signIn({ permissions: ["announcements.manage"] });
    expect(await saveAnnouncementAction(undefined, formOf({ title: "X", publishAt: "2026-06-01T09:00", expiresAt: "2026-05-01T09:00" }))).toMatchObject({
      ok: false,
      fieldErrors: { expiresAt: ["Must be after the publish date."] },
    });
  });
});
```

- [ ] **Step 3: Run the integration tests**

Run: `npm run test:int -- src/server/actions/announcements.int.test.ts`
Expected: PASS (4 tests). If the test database isn't running, start it per `docs/superpowers/plans/` dev-environment notes (`npx prisma dev`) before running.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/announcements.ts src/server/actions/announcements.int.test.ts
git commit -m "feat(announcements): add publish/unpublish action and integration tests"
```

---

## Task 5: Cached public data loader

**Files:**
- Create: `src/lib/data/announcements.ts`
- Modify: `src/lib/pages/registry.ts:17` (additive)

**Interfaces:**
- Consumes: `isAnnouncementVisible`, `selectBannerAnnouncement` (Task 1); `getPageSetting` from `src/lib/data/pages.ts:26`; `isPageLive` from `src/lib/pages/registry.ts:32`; `TAGS` from `src/lib/cache-tags.ts`; `db` from `src/lib/db.ts`.
- Produces: `AnnouncementDTO` type, `getPublishedAnnouncements()`, `getVisibleAnnouncements(now?)`, `getPublicAnnouncement(slug)`, `getHomepageAnnouncements(maxItems)`, `getBannerAnnouncement(now?)`. Consumed by Task 6 (homepage section), Task 9/10 (public pages), Task 11 (banner), and the sitemap edit in Task 12.

- [ ] **Step 1: Write the data loader**

```ts
// src/lib/data/announcements.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { isAnnouncementVisible, selectBannerAnnouncement } from "@/lib/announcements/visibility";
import { TAGS } from "@/lib/cache-tags";
import { getPageSetting } from "@/lib/data/pages";
import { db } from "@/lib/db";
import { isPageLive } from "@/lib/pages/registry";

export type AnnouncementDTO = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  pinned: boolean;
  showOnHomepage: boolean;
  showAsBanner: boolean;
  linkUrl: string | null;
  linkLabel: string | null;
  publishAt: string;
  expiresAt: string | null;
  updatedAt: string;
};

async function loadPublishedAnnouncements(): Promise<AnnouncementDTO[]> {
  const rows = await db.announcement.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      content: true,
      priority: true,
      pinned: true,
      showOnHomepage: true,
      showAsBanner: true,
      linkUrl: true,
      linkLabel: true,
      publishAt: true,
      expiresAt: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    publishAt: r.publishAt.toISOString(),
    expiresAt: r.expiresAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Every PUBLISHED row. Tag-invalidated on writes, and re-fetched at least every 60s so publishAt/expiresAt windows stay accurate. */
export const getPublishedAnnouncements = unstable_cache(loadPublishedAnnouncements, ["published-announcements"], {
  tags: [TAGS.announcements],
  revalidate: 60,
});

/** PUBLISHED rows currently inside their publishAt/expiresAt window. */
export async function getVisibleAnnouncements(now: Date = new Date()): Promise<AnnouncementDTO[]> {
  const rows = await getPublishedAnnouncements();
  return rows.filter((a) => isAnnouncementVisible({ status: "PUBLISHED", publishAt: new Date(a.publishAt), expiresAt: a.expiresAt ? new Date(a.expiresAt) : null }, now));
}

export async function getPublicAnnouncement(slug: string): Promise<AnnouncementDTO | null> {
  const rows = await getVisibleAnnouncements();
  return rows.find((a) => a.slug === slug) ?? null;
}

export async function getHomepageAnnouncements(maxItems: number): Promise<AnnouncementDTO[]> {
  const rows = await getVisibleAnnouncements();
  return rows.filter((a) => a.showOnHomepage).slice(0, maxItems);
}

/** Highest-priority visible banner announcement, or null when Announcements is disabled or none qualify. */
export async function getBannerAnnouncement(now: Date = new Date()): Promise<AnnouncementDTO | null> {
  const page = await getPageSetting("ANNOUNCEMENTS");
  if (!page || !isPageLive(page)) return null;
  const rows = await getVisibleAnnouncements(now);
  const candidates = rows.map((a) => ({ ...a, status: "PUBLISHED" as const, publishAt: new Date(a.publishAt), expiresAt: a.expiresAt ? new Date(a.expiresAt) : null, updatedAt: new Date(a.updatedAt) }));
  const winner = selectBannerAnnouncement(candidates, now);
  return winner ? (rows.find((a) => a.id === winner.id) ?? null) : null;
}
```

- [ ] **Step 2: Add `ANNOUNCEMENTS` to `IMPLEMENTED_PAGES`**

In `src/lib/pages/registry.ts`, find:

```ts
export const IMPLEMENTED_PAGES: ReadonlySet<PageKey> = new Set<PageKey>(["HOME", "EVENTS", "SPONSORS", "ABOUT", "CONTACT"]);
```

Replace with:

```ts
export const IMPLEMENTED_PAGES: ReadonlySet<PageKey> = new Set<PageKey>(["HOME", "EVENTS", "SPONSORS", "ABOUT", "CONTACT", "ANNOUNCEMENTS"]);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/announcements.ts src/lib/pages/registry.ts
git commit -m "feat(announcements): add cached public data loader and enable the page"
```

---

## Task 6: Switch the homepage announcements section to the cached loader

**Files:**
- Modify: `src/components/homepage/sections/announcements.tsx`

**Interfaces:**
- Consumes: `getHomepageAnnouncements` (Task 5).

- [ ] **Step 1: Replace the direct `db` query with the cached loader**

Replace the full contents of `src/components/homepage/sections/announcements.tsx`:

```tsx
// src/components/homepage/sections/announcements.tsx
import Link from "next/link";
import { getHomepageAnnouncements } from "@/lib/data/announcements";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function AnnouncementsSection({ section }: { section: SectionOfType<"announcements"> }) {
  const rows = await getHomepageAnnouncements(section.content.maxItems);
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-6 font-display text-2xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid gap-3">
        {rows.map((a) => (
          <li key={a.id}>
            <Link href={`/announcements/${a.slug}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-leaf/30">
              <p className="font-medium">{a.title}</p>
              {a.summary && <p className="text-sm text-muted">{a.summary}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

This fixes a real bug: the previous version queried `status: "PUBLISHED"` and `publishAt: { lte: now }` but never checked `expiresAt`, so expired announcements kept showing on the homepage. It also had no cache tag, so admin edits needed a full server restart to show.

- [ ] **Step 2: Commit**

```bash
git add src/components/homepage/sections/announcements.tsx
git commit -m "fix(homepage): use the cached, expiry-aware announcements loader"
```

---

## Task 7: Admin list page

**Files:**
- Create: `src/app/admin/(panel)/announcements/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` from `src/components/admin/page-header.tsx`; `Input` from `src/components/ui/input.tsx`; `can`, `requirePagePermission` from `src/lib/auth/guard.ts`; `ANNOUNCEMENT_PRIORITY_LABELS` (Task 2); `db` from `src/lib/db.ts`; `cn` from `src/lib/utils/cn.ts`; `Prisma` type from `@/generated/prisma/client`.

- [ ] **Step 1: Write the list page**

```tsx
// src/app/admin/(panel)/announcements/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Input } from "@/components/ui/input";
import type { Prisma } from "@/generated/prisma/client";
import { ANNOUNCEMENT_PRIORITY_LABELS } from "@/lib/announcements/schema";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Announcements" };

const VIEWS = ["all", "published", "draft"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { all: "All", published: "Published", draft: "Drafts" };

function whereFor(view: View): Prisma.AnnouncementWhereInput {
  if (view === "published") return { status: "PUBLISHED" };
  if (view === "draft") return { status: "DRAFT" };
  return {};
}

export default async function AnnouncementsAdminPage({ searchParams }: PageProps<"/admin/announcements">) {
  const me = await requirePagePermission("announcements.manage");
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "all";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const where: Prisma.AnnouncementWhereInput = { AND: [whereFor(view), q ? { title: { contains: q, mode: "insensitive" } } : {}] };

  const [rows, ...counts] = await Promise.all([
    db.announcement.findMany({ where, orderBy: [{ pinned: "desc" }, { publishAt: "desc" }], take: 100 }),
    ...VIEWS.map((v) => db.announcement.count({ where: whereFor(v) })),
  ]);

  return (
    <div className="grid max-w-5xl gap-8">
      <PageHeader
        eyebrow="Content"
        title="Announcements"
        description="Post updates, deadlines and news for the chapter site."
        actions={
          <Link href="/admin/announcements/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            <Plus className="size-4" aria-hidden="true" /> New announcement
          </Link>
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Announcement deleted.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter announcements" className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
          {VIEWS.map((v, i) => (
            <Link
              key={v}
              href={`/admin/announcements?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={v === view ? "page" : undefined}
              className={cn("rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-frost", v === view && "bg-raised text-frost")}
            >
              {VIEW_LABELS[v]} <span className="text-xs text-muted">{counts[i]}</span>
            </Link>
          ))}
        </nav>
        <form method="get" className="relative w-full sm:w-72">
          <input type="hidden" name="view" value={view} />
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Search by title" aria-label="Search announcements" className="pl-9" />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">{q ? "No announcements match that search." : `No ${VIEW_LABELS[view].toLowerCase()} announcements.`}</p>
          {can(me, "announcements.manage") && (
            <Link href="/admin/announcements/new" className="text-sm text-leaf hover:underline">
              Create an announcement
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/announcements/${a.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-leaf/30">
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{a.title}</span>
                    {a.pinned && <span className="rounded-full border border-leaf/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-leaf">Pinned</span>}
                  </span>
                  <span className="truncate text-sm text-muted">{a.summary || "No summary"}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em]", a.status === "PUBLISHED" ? "bg-leaf/15 text-leaf" : "bg-raised text-muted")}>
                  {a.status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
                <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted sm:inline">{ANNOUNCEMENT_PRIORITY_LABELS[a.priority]}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/admin/(panel)/announcements/page.tsx"
git commit -m "feat(announcements): add admin list page"
```

---

## Task 8: Admin form component and status bar

**Files:**
- Create: `src/app/admin/(panel)/announcements/announcement-form.tsx`
- Create: `src/app/admin/(panel)/announcements/status-bar.tsx`

**Interfaces:**
- Consumes: `ConfirmSubmit` from `src/components/admin/confirm-submit.tsx`; `SaveBar`, `fieldErrorFor`, `useFormAction` from `src/components/admin/form-state.tsx`; `Panel` from `src/components/admin/page-header.tsx`; `RichTextEditor` from `src/components/admin/rich-text-editor.tsx:81` (props `{ id, name, initialHtml, placeholder? }`); `Field`, `describedBy` from `src/components/ui/field.tsx`; `FormMessage` from `src/components/ui/form-message.tsx`; `Input`, `Label`, `Select`, `Switch`, `Textarea`, `Button` from `src/components/ui/*`; `ANNOUNCEMENT_PRIORITIES`, `ANNOUNCEMENT_PRIORITY_LABELS` (Task 2); `saveAnnouncementAction`, `deleteAnnouncementAction`, `setAnnouncementStatusAction` (Tasks 3–4).
- Produces: `AnnouncementForm`, `AnnouncementFormValues` type, `DeleteAnnouncementForm`, `AnnouncementStatusBar`. Consumed by Task 9 (new/edit pages).

- [ ] **Step 1: Write the form component**

```tsx
// src/app/admin/(panel)/announcements/announcement-form.tsx
"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Panel } from "@/components/admin/page-header";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ANNOUNCEMENT_PRIORITIES, ANNOUNCEMENT_PRIORITY_LABELS } from "@/lib/announcements/schema";
import { deleteAnnouncementAction, saveAnnouncementAction } from "@/server/actions/announcements";

export type AnnouncementFormValues = {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  content: string;
  publishAt: string;
  expiresAt: string;
  linkUrl: string;
  linkLabel: string;
  priority: (typeof ANNOUNCEMENT_PRIORITIES)[number];
  pinned: boolean;
  showOnHomepage: boolean;
  showAsBanner: boolean;
};

export function AnnouncementForm({ values, timezone }: { values: AnnouncementFormValues; timezone: string }) {
  const { state, pending, onSubmit } = useFormAction(saveAnnouncementAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" error={err("title")} className="sm:col-span-2">
            <Input id="title" name="title" defaultValue={values.title} maxLength={160} required {...describedBy("title", err("title"))} />
          </Field>
          <Field label="Page address" htmlFor="slug" error={err("slug")} hint="Leave blank to generate one from the title." className="sm:col-span-2">
            <div className="flex items-center overflow-hidden rounded-lg border border-line bg-night focus-within:border-leaf">
              <span className="pl-3 font-mono text-xs text-muted">/announcements/</span>
              <input id="slug" name="slug" defaultValue={values.slug} maxLength={80} className="h-10 min-w-0 flex-1 bg-transparent pr-3 font-mono text-sm text-frost focus:outline-none" />
            </div>
          </Field>
          <Field label="Summary" htmlFor="summary" error={err("summary")} hint="Shown on lists, the homepage and the banner." className="sm:col-span-2">
            <Textarea id="summary" name="summary" rows={2} defaultValue={values.summary} maxLength={240} />
          </Field>
        </div>
      </Panel>

      <Panel title="Details page">
        <div className="grid gap-1.5">
          <Label htmlFor="content" id="content-label">
            Content
          </Label>
          <RichTextEditor id="content" name="content" initialHtml={values.content} placeholder="Write the full announcement…" />
          <FormMessage>{err("content")}</FormMessage>
        </div>
      </Panel>

      <Panel title="Timing" description={`Times are in ${timezone.replaceAll("_", " ")} (change it in Site settings).`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Publishes at" htmlFor="publishAt" error={err("publishAt")} hint="When it becomes visible. Can be in the future.">
            <Input id="publishAt" name="publishAt" type="datetime-local" defaultValue={values.publishAt} required {...describedBy("publishAt", err("publishAt"))} />
          </Field>
          <Field label="Expires at" htmlFor="expiresAt" error={err("expiresAt")} hint="Optional. Hidden automatically after this time.">
            <Input id="expiresAt" name="expiresAt" type="datetime-local" defaultValue={values.expiresAt} />
          </Field>
        </div>
      </Panel>

      <Panel title="Link" description="Optional call-to-action shown on cards and the banner.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link address" htmlFor="linkUrl" error={err("linkUrl")}>
            <Input id="linkUrl" name="linkUrl" type="url" defaultValue={values.linkUrl} placeholder="https://…" />
          </Field>
          <Field label="Link label" htmlFor="linkLabel" error={err("linkLabel")} hint='e.g. "Register now"'>
            <Input id="linkLabel" name="linkLabel" defaultValue={values.linkLabel} maxLength={40} />
          </Field>
        </div>
      </Panel>

      <Panel title="Visibility">
        <Field label="Priority" htmlFor="priority" error={err("priority")} hint="Controls colour and which announcement wins the banner slot.">
          <Select id="priority" name="priority" defaultValue={values.priority}>
            {ANNOUNCEMENT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {ANNOUNCEMENT_PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-6">
          <Switch name="pinned" label="Pin to the top of the list" defaultChecked={values.pinned} />
          <Switch name="showOnHomepage" label="Show on the homepage" defaultChecked={values.showOnHomepage} />
          <Switch name="showAsBanner" label="Show as the site-wide banner" defaultChecked={values.showAsBanner} />
        </div>
      </Panel>

      <SaveBar state={state} pending={pending} label={values.id ? "Save changes" : "Create draft"} savedMessage="Saved. Published announcements update on the website right away." />
    </form>
  );
}

export function DeleteAnnouncementForm({ id }: { id: string }) {
  const { state, pending, onSubmit } = useFormAction(deleteAnnouncementAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit label="Delete announcement" confirmLabel="Delete permanently" disabled={pending} />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
```

- [ ] **Step 2: Write the status bar**

```tsx
// src/app/admin/(panel)/announcements/status-bar.tsx
"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { setAnnouncementStatusAction } from "@/server/actions/announcements";

export function AnnouncementStatusBar({ id, status, publicUrl }: { id: string; status: "DRAFT" | "PUBLISHED"; publicUrl: string | null }) {
  const { state, pending, onSubmit } = useFormAction(setAnnouncementStatusAction);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <form onSubmit={onSubmit} className="grid gap-1">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="to" value={status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
        {status === "PUBLISHED" ? (
          <ConfirmSubmit label="Unpublish" confirmLabel="Unpublish" variant="secondary" disabled={pending} />
        ) : (
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Working…" : "Publish"}
          </Button>
        )}
        {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      </form>
      {publicUrl && (
        <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] text-muted hover:text-frost">
          View on site
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(panel)/announcements/announcement-form.tsx" "src/app/admin/(panel)/announcements/status-bar.tsx"
git commit -m "feat(announcements): add admin form and publish/unpublish status bar"
```

---

## Task 9: Admin new/edit pages

**Files:**
- Create: `src/app/admin/(panel)/announcements/new/page.tsx`
- Create: `src/app/admin/(panel)/announcements/[id]/page.tsx`

**Interfaces:**
- Consumes: `requirePagePermission` from `src/lib/auth/guard.ts`; `loadSiteSettings` from `src/lib/data/site.ts`; `utcToZonedInput` from `src/lib/utils/timezone.ts:44`; `AnnouncementForm`, `AnnouncementFormValues`, `DeleteAnnouncementForm` (Task 8); `AnnouncementStatusBar` (Task 8); `Panel` from `src/components/admin/page-header.tsx`; `db` from `src/lib/db.ts`.

- [ ] **Step 1: Write the new-announcement page**

```tsx
// src/app/admin/(panel)/announcements/new/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { utcToZonedInput } from "@/lib/utils/timezone";
import { AnnouncementForm } from "../announcement-form";

export const metadata: Metadata = { title: "New announcement" };

export default async function NewAnnouncementPage() {
  await requirePagePermission("announcements.manage");
  const { timezone } = await loadSiteSettings();
  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/admin/announcements" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All announcements
      </Link>
      <PageHeader eyebrow="Announcements" title="New announcement" />
      <AnnouncementForm
        timezone={timezone}
        values={{
          id: null,
          title: "",
          slug: "",
          summary: "",
          content: "",
          publishAt: utcToZonedInput(new Date(), timezone),
          expiresAt: "",
          linkUrl: "",
          linkLabel: "",
          priority: "NORMAL",
          pinned: false,
          showOnHomepage: true,
          showAsBanner: false,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the edit page**

```tsx
// src/app/admin/(panel)/announcements/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { utcToZonedInput } from "@/lib/utils/timezone";
import { AnnouncementForm, DeleteAnnouncementForm } from "../announcement-form";
import { AnnouncementStatusBar } from "../status-bar";

export const metadata: Metadata = { title: "Edit announcement" };

export default async function EditAnnouncementPage({ params, searchParams }: PageProps<"/admin/announcements/[id]">) {
  await requirePagePermission("announcements.manage");
  const { id } = await params;
  const sp = await searchParams;
  const announcement = await db.announcement.findUnique({ where: { id } });
  if (!announcement) notFound();
  const { timezone } = await loadSiteSettings();

  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/admin/announcements" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All announcements
      </Link>
      <header className="grid gap-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{announcement.title}</h1>
        <AnnouncementStatusBar id={announcement.id} status={announcement.status} publicUrl={announcement.status === "PUBLISHED" ? `/announcements/${announcement.slug}` : null} />
      </header>
      {sp.created && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Draft created. Publish it when it&apos;s ready.
        </p>
      )}
      <AnnouncementForm
        timezone={timezone}
        values={{
          id: announcement.id,
          title: announcement.title,
          slug: announcement.slug,
          summary: announcement.summary,
          content: announcement.content,
          publishAt: utcToZonedInput(announcement.publishAt, timezone),
          expiresAt: announcement.expiresAt ? utcToZonedInput(announcement.expiresAt, timezone) : "",
          linkUrl: announcement.linkUrl ?? "",
          linkLabel: announcement.linkLabel ?? "",
          priority: announcement.priority,
          pinned: announcement.pinned,
          showOnHomepage: announcement.showOnHomepage,
          showAsBanner: announcement.showAsBanner,
        }}
      />
      <Panel title="Delete announcement">
        <DeleteAnnouncementForm id={announcement.id} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(panel)/announcements/new/page.tsx" "src/app/admin/(panel)/announcements/[id]/page.tsx"
git commit -m "feat(announcements): add admin new and edit pages"
```

---

## Task 10: Public list and detail pages

**Files:**
- Create: `src/app/(site)/announcements/page.tsx`
- Create: `src/app/(site)/announcements/[slug]/page.tsx`

**Interfaces:**
- Consumes: `assertPageEnabled` from `src/lib/data/pages.ts:35`; `getVisibleAnnouncements`, `getPublicAnnouncement` (Task 5); `getSiteSettings` from `src/lib/data/site.ts`; `metadataForPage` from `src/lib/seo.ts:18`; `sanitizeRichText`, `richTextToPlain` from `src/lib/content/sanitize.ts`; `formatInZone` from `src/lib/utils/timezone.ts:56`; `Rings` from `src/components/site/rings.tsx`; `ANNOUNCEMENT_PRIORITY_LABELS` (Task 2).

- [ ] **Step 1: Write the public list page**

```tsx
// src/app/(site)/announcements/page.tsx
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Rings } from "@/components/site/rings";
import { ANNOUNCEMENT_PRIORITY_LABELS } from "@/lib/announcements/schema";
import { getVisibleAnnouncements } from "@/lib/data/announcements";
import { assertPageEnabled } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { metadataForPage } from "@/lib/seo";
import { formatInZone } from "@/lib/utils/timezone";

export async function generateMetadata() {
  return metadataForPage("ANNOUNCEMENTS", { title: "Announcements", description: "Updates, deadlines and news from the chapter." });
}

export default async function AnnouncementsPage() {
  const page = await assertPageEnabled("ANNOUNCEMENTS");
  const [rows, site] = await Promise.all([getVisibleAnnouncements(), getSiteSettings()]);

  return (
    <div className="relative isolate">
      <Rings className="pointer-events-none absolute -right-60 -top-40 -z-10 size-[720px] opacity-40" />
      <section className="mx-auto grid max-w-4xl gap-5 px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">Updates from the chapter</h1>
        <p className="max-w-2xl text-lg text-muted">Deadlines, results and news, newest first.</p>
      </section>

      <section aria-label="Announcements" className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        {rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Nothing posted yet. Check back soon.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((a) => (
              <li key={a.id}>
                <Link href={`/announcements/${a.slug}`} className="reveal grid gap-2 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-leaf/30">
                  <span className="flex flex-wrap items-center gap-2">
                    {a.pinned && <span className="rounded-full border border-leaf/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-leaf">Pinned</span>}
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{ANNOUNCEMENT_PRIORITY_LABELS[a.priority]}</span>
                    <span className="font-mono text-[11px] text-muted">{formatInZone(a.publishAt, site.timezone, { day: "numeric", month: "short", year: "numeric" })}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-display text-xl font-bold">{a.title}</span>
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  </span>
                  {a.summary && <span className="text-sm text-muted">{a.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write the public detail page**

```tsx
// src/app/(site)/announcements/[slug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Rings } from "@/components/site/rings";
import { ANNOUNCEMENT_PRIORITY_LABELS } from "@/lib/announcements/schema";
import { richTextToPlain, sanitizeRichText } from "@/lib/content/sanitize";
import { getPublicAnnouncement } from "@/lib/data/announcements";
import { assertPageEnabled } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { formatInZone } from "@/lib/utils/timezone";

export async function generateMetadata({ params }: PageProps<"/announcements/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const announcement = await getPublicAnnouncement(slug);
  if (!announcement) return {};
  const description = announcement.summary || richTextToPlain(announcement.content, 160);
  return {
    title: announcement.title,
    description,
    alternates: { canonical: `/announcements/${announcement.slug}` },
    openGraph: { type: "article", title: announcement.title, description, url: `/announcements/${announcement.slug}` },
  };
}

export default async function AnnouncementPage({ params }: PageProps<"/announcements/[slug]">) {
  await assertPageEnabled("ANNOUNCEMENTS");
  const { slug } = await params;
  const [announcement, site] = await Promise.all([getPublicAnnouncement(slug), getSiteSettings()]);
  if (!announcement) notFound();
  const content = sanitizeRichText(announcement.content);

  return (
    <article className="relative isolate">
      <Rings className="pointer-events-none absolute -left-72 -top-24 -z-10 size-[760px] opacity-35" />
      <div className="mx-auto grid max-w-3xl gap-6 px-4 py-14 sm:px-6 lg:px-8">
        <Link href="/announcements" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-frost">
          <ArrowLeft className="size-4" aria-hidden="true" /> All announcements
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-leaf">{ANNOUNCEMENT_PRIORITY_LABELS[announcement.priority]}</span>
          <span className="font-mono text-[11px] text-muted">{formatInZone(announcement.publishAt, site.timezone, { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
        <h1 className="font-display text-4xl font-extrabold leading-[0.98] tracking-tight sm:text-5xl">{announcement.title}</h1>
        {announcement.summary && <p className="text-lg text-muted">{announcement.summary}</p>}
        {content && <div className="rich-text max-w-[68ch]" dangerouslySetInnerHTML={{ __html: content }} />}
        {announcement.linkUrl && (
          <a
            href={announcement.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-fit items-center gap-2 rounded-full bg-leaf px-6 font-semibold text-night shadow-[0_14px_40px_-14px_rgb(92_201_123/0.8)] transition-transform hover:-translate-y-0.5"
          >
            {announcement.linkLabel || "Learn more"} <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(site)/announcements/page.tsx" "src/app/(site)/announcements/[slug]/page.tsx"
git commit -m "feat(announcements): add public list and detail pages"
```

---

## Task 11: Site-wide dismissible banner

**Files:**
- Create: `src/components/site/announcement-banner.tsx`
- Modify: `src/app/(site)/layout.tsx`

**Interfaces:**
- Consumes: `dismissalKey` (Task 1); `getBannerAnnouncement`, `AnnouncementDTO` (Task 5); `cn` from `src/lib/utils/cn.ts`.

- [ ] **Step 1: Write the banner component**

```tsx
// src/components/site/announcement-banner.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { dismissalKey } from "@/lib/announcements/visibility";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "gfg-dismissed-announcement";

export type BannerAnnouncement = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  linkUrl: string | null;
  linkLabel: string | null;
  updatedAt: string;
};

const TONE: Record<BannerAnnouncement["priority"], string> = {
  NORMAL: "border-line bg-surface",
  IMPORTANT: "border-amber/40 bg-amber/10",
  URGENT: "border-red/40 bg-red/10",
};

/** Reads localStorage only after mount, so the server-rendered and first client render both show the banner (no hydration mismatch). */
export function AnnouncementBanner({ announcement }: { announcement: BannerAnnouncement }) {
  const key = dismissalKey(announcement);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === key) setDismissed(true);
    } catch {
      // Storage unavailable (private mode, blocked cookies): leave the banner shown.
    }
  }, [key]);

  if (dismissed) return null;
  const href = announcement.linkUrl || `/announcements/${announcement.slug}`;
  const external = Boolean(announcement.linkUrl);

  return (
    <div role="status" className={cn("border-b px-4 py-2.5 text-sm sm:px-6 lg:px-8", TONE[announcement.priority])}>
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <p className="min-w-0 flex-1 truncate">
          <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="hover:underline">
            <span className="font-semibold">{announcement.title}</span>
            {announcement.summary && <span className="text-muted"> — {announcement.summary}</span>}
          </Link>
        </p>
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEY, key);
            } catch {
              // Ignore: dismissal just won't persist across reloads.
            }
            setDismissed(true);
          }}
          className="shrink-0 rounded-md p-1 text-muted hover:bg-raised hover:text-frost"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the public shell**

In `src/app/(site)/layout.tsx`, find the imports block:

```ts
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getNavigation } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
```

Replace with:

```ts
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getBannerAnnouncement } from "@/lib/data/announcements";
import { getNavigation } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
```

Then find:

```tsx
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [settings, nav] = await Promise.all([getSiteSettings(), getNavigation()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-leaf focus:px-3 focus:py-2 focus:text-night"
      >
        Skip to content
      </a>
      <SiteHeader clubName={settings.clubName} shortName={settings.shortName} nav={nav} cta={settings.navCta} logo={settings.logo} />
```

Replace with:

```tsx
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [settings, nav, banner] = await Promise.all([getSiteSettings(), getNavigation(), getBannerAnnouncement()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-leaf focus:px-3 focus:py-2 focus:text-night"
      >
        Skip to content
      </a>
      {banner && <AnnouncementBanner announcement={banner} />}
      <SiteHeader clubName={settings.clubName} shortName={settings.shortName} nav={nav} cta={settings.navCta} logo={settings.logo} />
```

(`{children}`, `<SiteFooter .../>` and the closing tags below are unchanged.)

- [ ] **Step 3: Commit**

```bash
git add src/components/site/announcement-banner.tsx "src/app/(site)/layout.tsx"
git commit -m "feat(announcements): add the site-wide dismissible banner"
```

---

## Task 12: Sitemap entries

**Files:**
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `getVisibleAnnouncements` (Task 5).

- [ ] **Step 1: Add the import**

In `src/app/sitemap.ts`, find:

```ts
import type { MetadataRoute } from "next";
import type { PageKey } from "@/generated/prisma/enums";
import { getPublicEvents } from "@/lib/data/events";
import { getPageSettings } from "@/lib/data/pages";
import { PAGE_ROUTES, isPageLive } from "@/lib/pages/registry";
```

Replace with:

```ts
import type { MetadataRoute } from "next";
import type { PageKey } from "@/generated/prisma/enums";
import { getVisibleAnnouncements } from "@/lib/data/announcements";
import { getPublicEvents } from "@/lib/data/events";
import { getPageSettings } from "@/lib/data/pages";
import { PAGE_ROUTES, isPageLive } from "@/lib/pages/registry";
```

- [ ] **Step 2: Add the entries**

Find:

```ts
  if (live("EVENTS")) {
    for (const e of await getPublicEvents()) {
      entries.push({ url: `${base}/events/${e.slug}`, lastModified: e.startAt, changeFrequency: "weekly", priority: 0.6 });
    }
  }
  return entries;
```

Replace with:

```ts
  if (live("EVENTS")) {
    for (const e of await getPublicEvents()) {
      entries.push({ url: `${base}/events/${e.slug}`, lastModified: e.startAt, changeFrequency: "weekly", priority: 0.6 });
    }
  }
  if (live("ANNOUNCEMENTS")) {
    for (const a of await getVisibleAnnouncements()) {
      entries.push({ url: `${base}/announcements/${a.slug}`, lastModified: new Date(a.updatedAt), changeFrequency: "weekly", priority: 0.5 });
    }
  }
  return entries;
```

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(announcements): list visible announcements in the sitemap"
```

---

## Task 13: Admin nav, quick actions, dashboard card and audit labels

**Files:**
- Modify: `src/components/admin/nav-items.ts`
- Modify: `src/components/admin/quick-actions.ts`
- Modify: `src/lib/audit-labels.ts`
- Modify: `src/app/admin/(panel)/page.tsx`

**Interfaces:**
- Consumes: `db` (already imported in dashboard `page.tsx`); `Megaphone` icon from `lucide-react`.

- [ ] **Step 1: Add the nav item**

In `src/components/admin/nav-items.ts`, change the import line:

```ts
import { CalendarDays, ClipboardList, FileStack, Handshake, Home, LayoutDashboard, ScrollText, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
```

to:

```ts
import { CalendarDays, ClipboardList, FileStack, Handshake, Home, LayoutDashboard, Megaphone, ScrollText, Settings, ShieldCheck, Users, type LucideIcon } from "lucide-react";
```

Then find:

```ts
  { href: "/admin/sponsors", label: "Sponsors", icon: Handshake, permission: "sponsors.manage", section: "Content" },
  { href: "/admin/homepage", label: "Homepage", icon: Home, permission: "homepage.edit", section: "Website" },
```

Replace with:

```ts
  { href: "/admin/sponsors", label: "Sponsors", icon: Handshake, permission: "sponsors.manage", section: "Content" },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, permission: "announcements.manage", section: "Content" },
  { href: "/admin/homepage", label: "Homepage", icon: Home, permission: "homepage.edit", section: "Website" },
```

- [ ] **Step 2: Add the quick action**

In `src/components/admin/quick-actions.ts`, change the import line:

```ts
import { CalendarPlus, ClipboardPlus, FileStack, Handshake, LayoutTemplate, Settings, ShieldPlus, UserPlus, type LucideIcon } from "lucide-react";
```

to:

```ts
import { CalendarPlus, ClipboardPlus, FileStack, Handshake, LayoutTemplate, Megaphone, Settings, ShieldPlus, UserPlus, type LucideIcon } from "lucide-react";
```

Then find:

```ts
  { href: "/admin/sponsors/new", label: "Add sponsor", description: "Logo, link and partner type", icon: Handshake, permission: "sponsors.manage" },
  { href: "/admin/users", label: "Invite an admin", description: "Send a single-use invite link", icon: UserPlus, permission: "admins.manage" },
```

Replace with:

```ts
  { href: "/admin/sponsors/new", label: "Add sponsor", description: "Logo, link and partner type", icon: Handshake, permission: "sponsors.manage" },
  { href: "/admin/announcements/new", label: "Post announcement", description: "Update, deadline or news item", icon: Megaphone, permission: "announcements.manage" },
  { href: "/admin/users", label: "Invite an admin", description: "Send a single-use invite link", icon: UserPlus, permission: "admins.manage" },
```

- [ ] **Step 3: Add audit labels**

In `src/lib/audit-labels.ts`, find:

```ts
  "sponsor.created": "Added a sponsor",
  "sponsor.updated": "Edited a sponsor",
  "sponsor.deleted": "Removed a sponsor",
```

Replace with:

```ts
  "sponsor.created": "Added a sponsor",
  "sponsor.updated": "Edited a sponsor",
  "sponsor.deleted": "Removed a sponsor",
  "announcement.created": "Created an announcement",
  "announcement.updated": "Edited an announcement",
  "announcement.published": "Published an announcement",
  "announcement.unpublished": "Unpublished an announcement",
  "announcement.deleted": "Deleted an announcement",
```

Then find:

```ts
  { value: "sponsor", label: "Sponsors" },
  { value: "category", label: "Event categories" },
```

Replace with:

```ts
  { value: "sponsor", label: "Sponsors" },
  { value: "announcement", label: "Announcements" },
  { value: "category", label: "Event categories" },
```

- [ ] **Step 4: Add the dashboard "live announcements" card**

In `src/app/admin/(panel)/page.tsx`, add the import — find:

```ts
import { can, requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
```

Replace with:

```ts
import { can, requirePagePermission } from "@/lib/auth/guard";
import { getVisibleAnnouncements } from "@/lib/data/announcements";
import { db } from "@/lib/db";
```

Find:

```ts
  const canEvents = can(user, "events.edit") || can(user, "events.publish") || can(user, "events.create");
  const now = new Date();

  const [activeAdmins, pendingInvites, pages, recent, upcoming, drafts, { timezone }] = await Promise.all([
    db.adminUser.count({ where: { isActive: true } }),
    canAdmins ? db.invite.count({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } }) : Promise.resolve(0),
    loadPageSettings(),
    canLogs ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
    canEvents
      ? db.event.findMany({ where: { lifecycle: { in: ["PUBLISHED", "CANCELLED"] }, endAt: { gte: now } }, orderBy: { startAt: "asc" }, take: 5 })
      : Promise.resolve([]),
    canEvents ? db.event.findMany({ where: { lifecycle: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 5 }) : Promise.resolve([]),
    loadSiteSettings(),
  ]);
```

Replace with:

```ts
  const canEvents = can(user, "events.edit") || can(user, "events.publish") || can(user, "events.create");
  const canAnnouncements = can(user, "announcements.manage");
  const now = new Date();

  const [activeAdmins, pendingInvites, pages, recent, upcoming, drafts, { timezone }, liveAnnouncements] = await Promise.all([
    db.adminUser.count({ where: { isActive: true } }),
    canAdmins ? db.invite.count({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } }) : Promise.resolve(0),
    loadPageSettings(),
    canLogs ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
    canEvents
      ? db.event.findMany({ where: { lifecycle: { in: ["PUBLISHED", "CANCELLED"] }, endAt: { gte: now } }, orderBy: { startAt: "asc" }, take: 5 })
      : Promise.resolve([]),
    canEvents ? db.event.findMany({ where: { lifecycle: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 5 }) : Promise.resolve([]),
    loadSiteSettings(),
    canAnnouncements ? getVisibleAnnouncements(now) : Promise.resolve([]),
  ]);
```

Then find the closing of the `canEvents` grid section:

```tsx
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
```

Replace with:

```tsx
          </Card>
        </div>
      )}

      {canAnnouncements && (
        <Card title="Live announcements" href="/admin/announcements" linkLabel="Manage">
          {liveAnnouncements.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing live right now. <Link href="/admin/announcements/new" className="text-leaf hover:underline">Post one</Link>
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {liveAnnouncements.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/announcements/${a.id}`} className="grid gap-0.5 rounded-xl p-2 -m-2 hover:bg-raised/50">
                    <span className="truncate font-medium">{a.title}</span>
                    {a.summary && <span className="truncate text-xs text-muted">{a.summary}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
```

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/nav-items.ts src/components/admin/quick-actions.ts src/lib/audit-labels.ts "src/app/admin/(panel)/page.tsx"
git commit -m "feat(announcements): wire up admin nav, quick action, audit labels and dashboard card"
```

---

## Task 14: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors. Fix any `react/no-unescaped-entities` or unused-import findings in the files this plan touched before proceeding.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. This runs `next typegen` first, which generates the `PageProps<"/admin/announcements/[id]">` and `PageProps<"/announcements/[slug]">` route types this plan relies on — if it fails on those, check the route folder names match the URLs exactly (`[id]`, `[slug]`).

- [ ] **Step 3: Unit tests**

Run: `npx vitest run`
Expected: all unit tests pass, including the 11 new tests in `src/lib/announcements/visibility.test.ts`.

- [ ] **Step 4: Integration tests**

Run: `npm run test:int`
Expected: all integration tests pass, including the 4 new tests in `src/server/actions/announcements.int.test.ts`. Requires the test Postgres server running (`npx prisma dev`, per `dev-environment-notes` — a second `prisma dev` server for `g4g-test` per spec §13).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: production build succeeds with no type or lint errors, confirming `/admin/announcements`, `/admin/announcements/new`, `/admin/announcements/[id]`, `/announcements` and `/announcements/[slug]` all compile as real routes.

- [ ] **Step 6: Manual smoke check (optional but recommended)**

Run: `npm run dev`, then in a browser:
1. Sign in as an admin with `announcements.manage`, create a draft announcement with `publishAt` in the past and "Show as the site-wide banner" on.
2. Publish it from `/admin/announcements/[id]`. Confirm the banner appears on any public page and links to `/announcements/[slug]`.
3. Dismiss the banner (X button), reload — it stays dismissed. Edit the announcement's title and save — the banner reappears (its `updatedAt` changed, so the dismissal key no longer matches).
4. Toggle "Show on the homepage" and confirm it appears in the homepage `announcements` section if that section is enabled in `/admin/homepage`.
5. Turn the Announcements page off in `/admin/pages` and confirm `/announcements`, `/announcements/[slug]` all 404, the banner stops rendering, and the nav link disappears.

- [ ] **Step 7: Final commit (only if Step 6 required fixes)**

```bash
git add -A
git commit -m "fix(announcements): address verification-gate findings"
```

---

## Self-Review Notes

**Spec coverage:** §5 Announcement model fields — all present in schema.ts/actions/DTO (Task 2, 3, 5). Visibility rule and banner priority selection — Task 1 (unit tested). §9 page toggle — Task 5 Step 2 (`IMPLEMENTED_PAGES`), gating in Tasks 10 and 11. §10 SEO — `generateMetadata` in Task 10 using `metadataForPage`/`richTextToPlain`; sitemap in Task 12. §11 security — `sanitizeRichText` called both on write (Task 3) and on render (Task 10); `requirePermission`/`requirePagePermission` on every action and page; Zod on every input. §12 a11y — banner has `role="status"`, dismiss button has `aria-label`, focus-visible styles inherited from shared `Input`/`Button`/`Switch` components; no new motion added (reduced-motion N/A, no animations introduced). §13 testing — Task 1 is TDD unit tests for visibility; Task 4 is integration tests for the actions. §14 routes — all four routes built (Tasks 7–10) matching the spec's route list exactly. §16 dashboard — Task 13 Step 4 adds the "live announcements" card and the "Post announcement" quick action was added in Step 2.

**Placeholder scan:** no TBD/TODO, no "similar to Task N" without code, no prop invented without being verified against the real source file (each component's real signature was read before use: `Button`, `Switch`, `Select`, `Field`, `FormMessage`, `Input`, `Textarea`, `RichTextEditor`, `SaveBar`, `ConfirmSubmit`, `Panel`, `PageHeader`).

**Type consistency:** `AnnouncementFormValues.priority` and `ANNOUNCEMENT_PRIORITIES` (Task 2/8) match `Announcement.priority: AnnouncementPriority` in `prisma/schema.prisma:487`. `AnnouncementDTO` (Task 5) field names match the `select` in the same task. `BannerAnnouncement` (Task 11) is a narrower shape of `AnnouncementDTO` — every field it reads (`id`, `slug`, `title`, `summary`, `priority`, `linkUrl`, `linkLabel`, `updatedAt`) exists on `AnnouncementDTO`, so passing `getBannerAnnouncement()`'s return value directly as the `announcement` prop type-checks by structural typing.
