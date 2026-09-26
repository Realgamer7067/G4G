# Phase 5c — Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship gallery albums + bulk photo upload + ordering + masonry + accessible lightbox (admin CRUD and public pages), and give the homepage CMS's About and Achievements sections an image picker (upload new or choose existing).

**Architecture:** Follows the existing per-domain layering: `src/lib/gallery/*` (Zod schemas + pure ordering/lightbox helpers, unit-tested), `src/server/actions/gallery.ts` (Server Actions, `requirePermission("gallery.manage")`, Zod-validated, audited, tagged-cache-invalidated), `src/lib/data/gallery.ts` (cached tagged loader for public reads, reused by the homepage `gallery_highlights` section), admin routes under `src/app/admin/(panel)/gallery/`, public routes under `src/app/(site)/gallery/`. The homepage image picker is a new shared client component (`src/components/admin/image-picker.tsx`) wired into the existing `About`/`Achievements` section forms via the same `images` map the forms builder already threads for content-block images.

**Tech Stack:** Next.js 16 (App Router) + TypeScript strict + Tailwind v4 + Prisma 7 / PostgreSQL + Zod 4 + dnd-kit (ordering) + native `<dialog>` (crop dialog, lightbox) — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-gfg-chapter-platform-design.md` (§5 data model, §6 media pipeline, §9 page toggles, §10 SEO, §11 security, §12 accessibility/performance, §14 routes, §16 dashboard, §17 phase 5).

## Global Constraints

- Next.js 16.3.4, React 19.3, Tailwind CSS 4.3, Zod 4, Motion 13. Prisma / `@prisma/client` / `@prisma/adapter-pg` pinned to exactly 7.10.0 — never install unpinned.
- Every Server Action starts with `requirePermission(...)`, validates input with Zod, mutates + `writeAuditLog()` in one `db.$transaction`, then calls `invalidate(...)` from `@/lib/cache-tags`.
- Public pages read through `src/lib/data/*`, cached with tag-based invalidation (`unstable_cache` + `TAGS`).
- Rich text is not used here (album/image text fields are plain strings) — React escaping is sufficient, no `dangerouslySetInnerHTML`.
- Uploads: images only, decoded with sharp, capped 15 MB / 50 MP, EXIF stripped, UUID filenames; served via `/media/[...path]` (PUBLIC visibility only).
- Keyboard reachable, visible focus (mint ring), alt text required on every image upload, `prefers-reduced-motion` disables non-essential transitions, images lazy with explicit width/height, admin-only libraries (dnd-kit) never ship to public routes.
- Disabled pages 404 (`assertPageEnabled`) and drop out of the sitemap and nav (`isPageLive` / `IMPLEMENTED_PAGES`).
- `AGENTS.md`: this Next.js version has breaking changes vs. training data — every Next API used below (`PageProps<...>`, `forbidden()`, `notFound()`, route handlers, `unstable_cache`, `generateMetadata`) is copied from code that already runs in this repo (sponsors, events, homepage), not invented.
- **Shared-file hazard:** `src/components/admin/nav-items.ts`, `src/components/admin/quick-actions.ts`, `src/lib/audit-labels.ts`, `src/lib/pages/registry.ts`, `src/app/sitemap.ts`, `src/lib/cache-tags.ts` are also touched by sibling plans 5a (announcements) and 5b (team), which run before this plan. Every edit to these files below is described as an anchored insertion (exact surrounding text to match), never a full-file rewrite — re-read the file at execution time and insert relative to the named anchor, which may have shifted.
- Do not touch announcements or team code.

---

## Task 1: Gallery schemas, pure ordering/lightbox helpers, audit labels

**Files:**
- Create: `src/lib/gallery/schema.ts`
- Create: `src/lib/gallery/reorder.ts`
- Create: `src/lib/gallery/reorder.test.ts`
- Create: `src/lib/gallery/lightbox.ts`
- Create: `src/lib/gallery/lightbox.test.ts`
- Modify: `src/lib/audit-labels.ts`

**Interfaces:**
- Produces: `albumFormSchema` (parses `Object.fromEntries(formData)` for create/update), `AlbumFormInput` type; `reorderIds(ids: string[], fromIndex: number, toIndex: number): string[]`; `wrapIndex(index: number, length: number, delta: number): number`.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write `reorderIds` and its test**

```ts
// src/lib/gallery/reorder.ts
/** Moves the id at fromIndex to toIndex, same shape as dnd-kit's onDragEnd gives you. Used for both album and image ordering — order is always "array index". */
export function reorderIds(ids: readonly string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
```

```ts
// src/lib/gallery/reorder.test.ts
import { describe, expect, it } from "vitest";
import { reorderIds } from "./reorder";

describe("reorderIds", () => {
  it("moves an id from one index to another", () => {
    expect(reorderIds(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reorderIds(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("is a no-op for equal indexes", () => {
    expect(reorderIds(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("returns a copy unchanged for out-of-range indexes", () => {
    expect(reorderIds(["a", "b"], -1, 1)).toEqual(["a", "b"]);
    expect(reorderIds(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run the reorder test to verify it passes**

Run: `npx vitest run src/lib/gallery/reorder.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 3: Write `wrapIndex` and its test**

```ts
// src/lib/gallery/lightbox.ts
/** Wraps a lightbox index by delta (+1 / -1) around [0, length). Returns 0 for length <= 0. */
export function wrapIndex(index: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}
```

```ts
// src/lib/gallery/lightbox.test.ts
import { describe, expect, it } from "vitest";
import { wrapIndex } from "./lightbox";

describe("wrapIndex", () => {
  it("advances within range", () => {
    expect(wrapIndex(0, 5, 1)).toBe(1);
    expect(wrapIndex(3, 5, 1)).toBe(4);
  });

  it("wraps past the end forward", () => {
    expect(wrapIndex(4, 5, 1)).toBe(0);
  });

  it("wraps past the start backward", () => {
    expect(wrapIndex(0, 5, -1)).toBe(4);
  });

  it("handles an empty gallery", () => {
    expect(wrapIndex(0, 0, 1)).toBe(0);
  });
});
```

- [ ] **Step 4: Run the lightbox test to verify it passes**

Run: `npx vitest run src/lib/gallery/lightbox.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the album/image Zod schemas**

```ts
// src/lib/gallery/schema.ts
import { z } from "zod";

export const albumFormSchema = z.object({
  id: z
    .string()
    .nullish()
    .transform((v) => v || null),
  title: z.string().trim().min(1, "Give the album a title.").max(100),
  description: z.string().trim().max(500).default(""),
  date: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date."),
  eventId: z
    .string()
    .nullish()
    .transform((v) => v || null),
  isPublished: z.unknown().optional(),
});
export type AlbumFormInput = z.infer<typeof albumFormSchema>;

/** ISO date (YYYY-MM-DD) -> UTC midnight, for the date-only <input type="date">. */
export function parseAlbumDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

/** Formats a stored album date back to the <input type="date"> value. */
export function formatAlbumDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

export const captionSchema = z.object({
  imageId: z.string().min(1),
  caption: z.string().trim().max(200).default(""),
});

export const bulkAddImageSchema = z.object({
  uploadId: z.string().min(1),
  alt: z.string().trim().min(1, "Every photo needs alt text.").max(300),
});
export const bulkAddImagesSchema = z.array(bulkAddImageSchema).min(1, "Add at least one photo.").max(60);
```

- [ ] **Step 6: Add gallery audit labels**

Read `src/lib/audit-labels.ts` first — a sibling plan may have already inserted lines after `"form.responses_exported": "Exported form responses",`. Insert the gallery entries immediately before the closing `};` of the `LABELS` object (i.e. directly after the last existing entry, whatever it is), and the `"gallery"` family immediately before the closing `];` of `AUDIT_ACTION_FAMILIES`:

```ts
  "gallery.album_created": "Created a gallery album",
  "gallery.album_updated": "Edited a gallery album",
  "gallery.album_deleted": "Deleted a gallery album",
  "gallery.album_published": "Published a gallery album",
  "gallery.album_unpublished": "Unpublished a gallery album",
  "gallery.album_reordered": "Reordered gallery albums",
  "gallery.cover_set": "Set a gallery album's cover photo",
  "gallery.images_added": "Added photos to a gallery album",
  "gallery.image_updated": "Edited a gallery photo's caption",
  "gallery.image_deleted": "Removed a gallery photo",
  "gallery.images_reordered": "Reordered photos in a gallery album",
```

```ts
  { value: "gallery", label: "Gallery" },
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/gallery/schema.ts src/lib/gallery/reorder.ts src/lib/gallery/reorder.test.ts src/lib/gallery/lightbox.ts src/lib/gallery/lightbox.test.ts src/lib/audit-labels.ts
git commit -m "feat(gallery): add schemas, pure ordering/lightbox helpers and audit labels"
```

---

## Task 2: Album server actions

**Files:**
- Create: `src/server/actions/gallery-albums.ts`
- Create: `src/server/actions/gallery-albums.int.test.ts`

**Interfaces:**
- Consumes: `albumFormSchema`, `parseAlbumDate`, `formatAlbumDate` (Task 1); `reorderIds` (Task 1, used client-side in Task 5, not here); `runAction`/`ActionResult` (`@/lib/actions`); `writeAuditLog` (`@/lib/audit`); `requirePermission` (`@/lib/auth/guard`); `TAGS`/`invalidate` (`@/lib/cache-tags`); `slugify`/`uniqueSlug` (`@/lib/utils/slug`); `ensureImages` (`@/server/media/images`); `getRequestMeta` (`@/lib/request-meta`).
- Produces: `saveAlbumAction(prev, formData): Promise<ActionResult>` (redirects to `/admin/gallery/[id]?created=1` on create), `deleteAlbumAction(prev, formData): Promise<ActionResult>` (redirects to `/admin/gallery?deleted=1`), `toggleAlbumPublishedAction(albumId: string): Promise<ActionResult<{ isPublished: boolean }>>`, `reorderAlbumsAction(ids: string[]): Promise<ActionResult>`, `setAlbumCoverAction(albumId: string, uploadId: string | null): Promise<ActionResult>`. These four plain-argument actions are consumed by Task 5's `AlbumList`/Task 6's album page and Task 8's image grid.

- [ ] **Step 1: Write the failing integration test**

```ts
// src/server/actions/gallery-albums.int.test.ts
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

const { saveAlbumAction, deleteAlbumAction, toggleAlbumPublishedAction, reorderAlbumsAction, setAlbumCoverAction } = await import("./gallery-albums");

async function createUpload(suffix: string) {
  return db.upload.create({
    data: {
      kind: "IMAGE",
      purpose: "GALLERY",
      visibility: "PUBLIC",
      originalName: `photo-${suffix}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 1000,
      width: 800,
      height: 600,
      storageKey: `2026/09/test-${suffix}`,
      variants: [{ name: "800", file: "800.webp", width: 800, height: 600, format: "webp", bytes: 500 }],
      alt: `Photo ${suffix}`,
    },
  });
}

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("album actions", () => {
  it("require gallery.manage", async () => {
    await signIn({ permissions: ["events.edit"] });
    expect(await saveAlbumAction(undefined, formOf({ title: "Orientation Day" }))).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("create, update and delete with audit and cache refresh", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const created = await saveAlbumAction(undefined, formOf({ title: "Orientation Day", description: "Welcoming the new batch." })).catch((e: Error) => e);
    const id = /REDIRECT:\/admin\/gallery\/([^?]+)\?created=1/.exec(String((created as Error).message))?.[1];
    expect(await db.galleryAlbum.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: "Orientation Day", slug: "orientation-day", isPublished: false });

    expect(await saveAlbumAction(undefined, formOf({ id: id!, title: "Orientation Day 2026", isPublished: "on" }))).toEqual({ ok: true, data: null });
    expect(await db.galleryAlbum.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: "Orientation Day 2026", isPublished: true });
    expect(cache.revalidateTag).toHaveBeenCalledWith("gallery", { expire: 0 });

    await expect(deleteAlbumAction(undefined, formOf({ id: id! }))).rejects.toThrow("REDIRECT:/admin/gallery?deleted=1");
    expect(await db.galleryAlbum.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: { startsWith: "gallery.album" } } })).toBe(3);
  });

  it("gives a fresh slug to a same-titled album", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    await saveAlbumAction(undefined, formOf({ title: "Hack Night" })).catch(() => {});
    await saveAlbumAction(undefined, formOf({ title: "Hack Night" })).catch(() => {});
    const slugs = (await db.galleryAlbum.findMany({ select: { slug: true } })).map((a) => a.slug).sort();
    expect(slugs).toEqual(["hack-night", "hack-night-2"]);
  });

  it("toggles published state", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const created = await saveAlbumAction(undefined, formOf({ title: "Toggle Me" })).catch((e: Error) => e);
    const id = /REDIRECT:\/admin\/gallery\/([^?]+)\?created=1/.exec(String((created as Error).message))?.[1]!;
    expect(await toggleAlbumPublishedAction(id)).toEqual({ ok: true, data: { isPublished: true } });
    expect(await toggleAlbumPublishedAction(id)).toEqual({ ok: true, data: { isPublished: false } });
  });

  it("reorders albums by exact id set only", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const a = await db.galleryAlbum.create({ data: { title: "A", slug: "a", order: 0 } });
    const b = await db.galleryAlbum.create({ data: { title: "B", slug: "b", order: 1 } });
    expect(await reorderAlbumsAction([b.id, a.id])).toEqual({ ok: true, data: null });
    expect(await db.galleryAlbum.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ order: 0 });
    expect(await db.galleryAlbum.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ order: 1 });
    expect(await reorderAlbumsAction([b.id])).toMatchObject({ ok: false });
  });

  it("sets a cover only from an image already in the album", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const album = await db.galleryAlbum.create({ data: { title: "Cover Test", slug: "cover-test" } });
    const outsideUpload = await createUpload("outside");
    expect(await setAlbumCoverAction(album.id, outsideUpload.id)).toMatchObject({ ok: false });

    const insideUpload = await createUpload("inside");
    await db.galleryImage.create({ data: { albumId: album.id, uploadId: insideUpload.id, order: 0 } });
    expect(await setAlbumCoverAction(album.id, insideUpload.id)).toEqual({ ok: true, data: null });
    expect(await db.galleryAlbum.findUniqueOrThrow({ where: { id: album.id } })).toMatchObject({ coverId: insideUpload.id });

    expect(await setAlbumCoverAction(album.id, null)).toEqual({ ok: true, data: null });
    expect(await db.galleryAlbum.findUniqueOrThrow({ where: { id: album.id } })).toMatchObject({ coverId: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:int -- src/server/actions/gallery-albums.int.test.ts`
Expected: FAIL (`Cannot find module './gallery-albums'`)

- [ ] **Step 3: Write the album actions**

```ts
// src/server/actions/gallery-albums.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { albumFormSchema, parseAlbumDate } from "@/lib/gallery/schema";
import { isChecked } from "@/lib/forms-data";
import { getRequestMeta } from "@/lib/request-meta";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { ensureImages } from "@/server/media/images";

export async function saveAlbumAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const input = albumFormSchema.parse(Object.fromEntries(formData));
    const isPublished = isChecked(input.isPublished);
    const existing = input.id ? await db.galleryAlbum.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That album no longer exists.");
    if (input.eventId) {
      const event = await db.event.findUnique({ where: { id: input.eventId }, select: { id: true } });
      if (!event) throw new UserError("That event no longer exists.");
    }
    const slug = existing
      ? existing.slug
      : await uniqueSlug(slugify(input.title), async (s) => {
          const hit = await db.galleryAlbum.findUnique({ where: { slug: s }, select: { id: true } });
          return Boolean(hit);
        });
    const meta = await getRequestMeta();
    const album = await db.$transaction(async (tx) => {
      const order = existing ? existing.order : await tx.galleryAlbum.count();
      const data = {
        title: input.title,
        slug,
        description: input.description,
        date: parseAlbumDate(input.date),
        eventId: input.eventId,
        isPublished,
        order,
      };
      const saved = existing ? await tx.galleryAlbum.update({ where: { id: existing.id }, data }) : await tx.galleryAlbum.create({ data });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "gallery.album_updated" : "gallery.album_created",
        target: { type: "GalleryAlbum", id: saved.id, label: saved.title },
        meta,
      });
      return saved;
    });
    invalidate(TAGS.gallery);
    revalidatePath("/admin/gallery");
    if (!existing) createdId = album.id;
    return null;
  });
  if (createdId) redirect(`/admin/gallery/${createdId}?created=1`);
  return result;
}

export async function deleteAlbumAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const album = await db.galleryAlbum.findUnique({ where: { id: String(formData.get("id") ?? "") }, include: { _count: { select: { images: true } } } });
    if (!album) throw new UserError("That album no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.galleryAlbum.delete({ where: { id: album.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "gallery.album_deleted",
        target: { type: "GalleryAlbum", id: album.id, label: album.title },
        metadata: { imageCount: album._count.images },
        meta,
      });
    });
    invalidate(TAGS.gallery);
    return null;
  });
  if (result.ok) redirect("/admin/gallery?deleted=1");
  return result;
}

export async function toggleAlbumPublishedAction(albumId: string): Promise<ActionResult<{ isPublished: boolean }>> {
  return runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const album = await db.galleryAlbum.findUnique({ where: { id: albumId } });
    if (!album) throw new UserError("That album no longer exists.");
    const next = !album.isPublished;
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.galleryAlbum.update({ where: { id: albumId }, data: { isPublished: next } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: next ? "gallery.album_published" : "gallery.album_unpublished",
        target: { type: "GalleryAlbum", id: albumId, label: album.title },
        meta,
      });
    });
    invalidate(TAGS.gallery);
    revalidatePath("/admin/gallery");
    return { isPublished: next };
  });
}

const idListSchema = z.array(z.string().min(1)).min(1);

export async function reorderAlbumsAction(ids: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const wanted = idListSchema.parse(ids);
    const albums = await db.galleryAlbum.findMany({ select: { id: true } });
    const currentIds = new Set(albums.map((a) => a.id));
    if (wanted.length !== currentIds.size || wanted.some((id) => !currentIds.has(id))) {
      throw new UserError("The album list changed. Reload and try again.");
    }
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await Promise.all(wanted.map((id, order) => tx.galleryAlbum.update({ where: { id }, data: { order } })));
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "gallery.album_reordered",
        target: { type: "GalleryAlbum", label: "Album order" },
        meta,
      });
    });
    invalidate(TAGS.gallery);
    revalidatePath("/admin/gallery");
    return null;
  });
}

export async function setAlbumCoverAction(albumId: string, uploadId: string | null): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const album = await db.galleryAlbum.findUnique({ where: { id: albumId } });
    if (!album) throw new UserError("That album no longer exists.");
    if (uploadId) {
      const inAlbum = await db.galleryImage.findFirst({ where: { albumId, uploadId }, select: { id: true } });
      if (!inAlbum) throw new UserError("Choose a photo that's already in this album.");
      await ensureImages(db, [uploadId]);
    }
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.galleryAlbum.update({ where: { id: albumId }, data: { coverId: uploadId } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "gallery.cover_set",
        target: { type: "GalleryAlbum", id: albumId, label: album.title },
        meta,
      });
    });
    invalidate(TAGS.gallery);
    revalidatePath(`/admin/gallery/${albumId}`);
    return null;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:int -- src/server/actions/gallery-albums.int.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/gallery-albums.ts src/server/actions/gallery-albums.int.test.ts
git commit -m "feat(gallery): add album create/update/delete/publish/reorder/cover actions"
```

---

## Task 3: Image server actions

**Files:**
- Create: `src/server/actions/gallery-images.ts`
- Create: `src/server/actions/gallery-images.int.test.ts`

**Interfaces:**
- Consumes: `bulkAddImagesSchema`, `captionSchema` (Task 1); `ensureImages`, `updateImageAlt` (`@/server/media/images`); same action/audit/cache/permission helpers as Task 2.
- Produces: `addGalleryImagesAction(albumId: string, images: { uploadId: string; alt: string }[]): Promise<ActionResult<{ added: number }>>`, `updateGalleryImageAction(albumId: string, imageId: string, caption: string): Promise<ActionResult>`, `reorderGalleryImagesAction(albumId: string, ids: string[]): Promise<ActionResult>`, `deleteGalleryImageAction(albumId: string, imageId: string): Promise<ActionResult>`. Consumed by Task 7 (bulk upload) and Task 8 (image grid).

- [ ] **Step 1: Write the failing integration test**

```ts
// src/server/actions/gallery-images.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { addGalleryImagesAction, updateGalleryImageAction, reorderGalleryImagesAction, deleteGalleryImageAction } = await import("./gallery-images");

async function createAlbum() {
  return db.galleryAlbum.create({ data: { title: "Test Album", slug: "test-album" } });
}

async function createUpload(suffix: string) {
  return db.upload.create({
    data: {
      kind: "IMAGE",
      purpose: "GALLERY",
      visibility: "PUBLIC",
      originalName: `photo-${suffix}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: 1000,
      width: 800,
      height: 600,
      storageKey: `2026/09/img-${suffix}`,
      variants: [{ name: "800", file: "800.webp", width: 800, height: 600, format: "webp", bytes: 500 }],
      alt: "",
    },
  });
}

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("image actions", () => {
  it("require gallery.manage", async () => {
    await signIn({ permissions: ["events.edit"] });
    const album = await createAlbum();
    expect(await addGalleryImagesAction(album.id, [])).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("bulk-adds images, sets alt text, and appends after existing ones", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const album = await createAlbum();
    const u1 = await createUpload("1");
    await db.galleryImage.create({ data: { albumId: album.id, uploadId: u1.id, order: 0 } });
    const u2 = await createUpload("2");
    const u3 = await createUpload("3");

    const result = await addGalleryImagesAction(album.id, [
      { uploadId: u2.id, alt: "Team building" },
      { uploadId: u3.id, alt: "Award ceremony" },
    ]);
    expect(result).toEqual({ ok: true, data: { added: 2 } });
    const images = await db.galleryImage.findMany({ where: { albumId: album.id }, orderBy: { order: "asc" } });
    expect(images.map((i) => i.order)).toEqual([0, 1, 2]);
    expect(await db.upload.findUniqueOrThrow({ where: { id: u2.id } })).toMatchObject({ alt: "Team building" });
    expect(cache.revalidateTag).toHaveBeenCalledWith("gallery", { expire: 0 });
  });

  it("updates a caption only for an image in that album", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const album = await createAlbum();
    const otherAlbum = await createAlbum();
    const upload = await createUpload("cap");
    const image = await db.galleryImage.create({ data: { albumId: album.id, uploadId: upload.id, order: 0 } });

    expect(await updateGalleryImageAction(otherAlbum.id, image.id, "Wrong album")).toMatchObject({ ok: false });
    expect(await updateGalleryImageAction(album.id, image.id, "Opening ceremony")).toEqual({ ok: true, data: null });
    expect(await db.galleryImage.findUniqueOrThrow({ where: { id: image.id } })).toMatchObject({ caption: "Opening ceremony" });
  });

  it("reorders images by exact id set only", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const album = await createAlbum();
    const u1 = await createUpload("r1");
    const u2 = await createUpload("r2");
    const i1 = await db.galleryImage.create({ data: { albumId: album.id, uploadId: u1.id, order: 0 } });
    const i2 = await db.galleryImage.create({ data: { albumId: album.id, uploadId: u2.id, order: 1 } });
    expect(await reorderGalleryImagesAction(album.id, [i2.id, i1.id])).toEqual({ ok: true, data: null });
    expect(await db.galleryImage.findUniqueOrThrow({ where: { id: i2.id } })).toMatchObject({ order: 0 });
    expect(await reorderGalleryImagesAction(album.id, [i2.id])).toMatchObject({ ok: false });
  });

  it("deletes an image and clears it as cover if it was one", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const album = await createAlbum();
    const upload = await createUpload("del");
    const image = await db.galleryImage.create({ data: { albumId: album.id, uploadId: upload.id, order: 0 } });
    await db.galleryAlbum.update({ where: { id: album.id }, data: { coverId: upload.id } });

    expect(await deleteGalleryImageAction(album.id, image.id)).toEqual({ ok: true, data: null });
    expect(await db.galleryImage.count({ where: { albumId: album.id } })).toBe(0);
    expect(await db.galleryAlbum.findUniqueOrThrow({ where: { id: album.id } })).toMatchObject({ coverId: null });
    expect(await db.upload.count({ where: { id: upload.id } })).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:int -- src/server/actions/gallery-images.int.test.ts`
Expected: FAIL (`Cannot find module './gallery-images'`)

- [ ] **Step 3: Write the image actions**

```ts
// src/server/actions/gallery-images.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { bulkAddImagesSchema, captionSchema } from "@/lib/gallery/schema";
import { getRequestMeta } from "@/lib/request-meta";
import { ensureImages } from "@/server/media/images";

async function loadAlbum(albumId: string) {
  const album = await db.galleryAlbum.findUnique({ where: { id: albumId } });
  if (!album) throw new UserError("That album no longer exists.");
  return album;
}

export async function addGalleryImagesAction(albumId: string, images: { uploadId: string; alt: string }[]): Promise<ActionResult<{ added: number }>> {
  return runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const album = await loadAlbum(albumId);
    const input = bulkAddImagesSchema.parse(images);
    await ensureImages(
      db,
      input.map((i) => i.uploadId),
    );
    const meta = await getRequestMeta();
    const added = await db.$transaction(async (tx) => {
      const start = await tx.galleryImage.count({ where: { albumId } });
      for (const [index, item] of input.entries()) {
        await tx.galleryImage.create({ data: { albumId, uploadId: item.uploadId, order: start + index } });
        await tx.upload.update({ where: { id: item.uploadId }, data: { alt: item.alt.trim().slice(0, 300) } });
      }
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "gallery.images_added",
        target: { type: "GalleryAlbum", id: albumId, label: album.title },
        metadata: { count: input.length },
        meta,
      });
      return input.length;
    });
    invalidate(TAGS.gallery);
    revalidatePath(`/admin/gallery/${albumId}`);
    return { added };
  });
}

export async function updateGalleryImageAction(albumId: string, imageId: string, caption: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const album = await loadAlbum(albumId);
    const image = await db.galleryImage.findFirst({ where: { id: imageId, albumId } });
    if (!image) throw new UserError("That photo isn't in this album.");
    const input = captionSchema.parse({ imageId, caption });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.galleryImage.update({ where: { id: imageId }, data: { caption: input.caption } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "gallery.image_updated",
        target: { type: "GalleryImage", id: imageId, label: album.title },
        meta,
      });
    });
    invalidate(TAGS.gallery);
    revalidatePath(`/admin/gallery/${albumId}`);
    return null;
  });
}

const idListSchema = z.array(z.string().min(1)).min(1);

export async function reorderGalleryImagesAction(albumId: string, ids: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const album = await loadAlbum(albumId);
    const wanted = idListSchema.parse(ids);
    const images = await db.galleryImage.findMany({ where: { albumId }, select: { id: true } });
    const currentIds = new Set(images.map((i) => i.id));
    if (wanted.length !== currentIds.size || wanted.some((id) => !currentIds.has(id))) {
      throw new UserError("The photo list changed. Reload and try again.");
    }
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await Promise.all(wanted.map((id, order) => tx.galleryImage.update({ where: { id }, data: { order } })));
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "gallery.images_reordered",
        target: { type: "GalleryAlbum", id: albumId, label: album.title },
        meta,
      });
    });
    invalidate(TAGS.gallery);
    revalidatePath(`/admin/gallery/${albumId}`);
    return null;
  });
}

export async function deleteGalleryImageAction(albumId: string, imageId: string): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("gallery.manage");
    const album = await loadAlbum(albumId);
    const image = await db.galleryImage.findFirst({ where: { id: imageId, albumId } });
    if (!image) throw new UserError("That photo isn't in this album.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.galleryImage.delete({ where: { id: imageId } });
      if (album.coverId === image.uploadId) {
        await tx.galleryAlbum.update({ where: { id: albumId }, data: { coverId: null } });
      }
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "gallery.image_deleted",
        target: { type: "GalleryImage", id: imageId, label: album.title },
        meta,
      });
    });
    invalidate(TAGS.gallery);
    revalidatePath(`/admin/gallery/${albumId}`);
    return null;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:int -- src/server/actions/gallery-images.int.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/gallery-images.ts src/server/actions/gallery-images.int.test.ts
git commit -m "feat(gallery): add image bulk-add/caption/reorder/delete actions"
```

---

## Task 4: Cached public data loader + switch the homepage `gallery_highlights` renderer

**Files:**
- Create: `src/lib/data/gallery.ts`
- Modify: `src/components/homepage/sections/gallery-highlights.tsx`

**Interfaces:**
- Consumes: `TAGS` (`@/lib/cache-tags`), `publicImageSelect`/`toPublicImage` (`@/lib/media/public-image`), `db` (`@/lib/db`).
- Produces: `GalleryAlbumCardDTO`, `GalleryAlbumDetailDTO`, `GalleryImageDTO` types; `getPublicAlbums(): Promise<GalleryAlbumCardDTO[]>`; `getPublicAlbum(slug: string): Promise<GalleryAlbumDetailDTO | null>`; `getGalleryHighlights(mode: "latest" | "album", albumId: string | null, maxItems: number): Promise<GalleryImageDTO[]>`. Consumed by Task 9 (`/gallery`), Task 10 (`/gallery/[album]`), and this task's own renderer swap.

- [ ] **Step 1: Write the loader**

```ts
// src/lib/data/gallery.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";

export type GalleryImageDTO = { id: string; caption: string; image: PublicImage };

export type GalleryAlbumCardDTO = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string | null;
  cover: PublicImage | null;
  imageCount: number;
};

export type GalleryAlbumDetailDTO = GalleryAlbumCardDTO & { images: GalleryImageDTO[] };

function toImageDTO(row: { id: string; caption: string; upload: Parameters<typeof toPublicImage>[0] }): GalleryImageDTO | null {
  const image = toPublicImage(row.upload);
  return image ? { id: row.id, caption: row.caption, image } : null;
}

async function loadPublicAlbums(): Promise<GalleryAlbumCardDTO[]> {
  const rows = await db.galleryAlbum.findMany({
    where: { isPublished: true },
    include: { cover: { select: publicImageSelect }, images: { orderBy: { order: "asc" }, take: 1, include: { upload: { select: publicImageSelect } } }, _count: { select: { images: true } } },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    date: a.date ? a.date.toISOString() : null,
    cover: toPublicImage(a.cover) ?? toPublicImage(a.images[0]?.upload),
    imageCount: a._count.images,
  }));
}

export const getPublicAlbums = unstable_cache(loadPublicAlbums, ["public-gallery-albums"], { tags: [TAGS.gallery] });

async function loadPublicAlbum(slug: string): Promise<GalleryAlbumDetailDTO | null> {
  const row = await db.galleryAlbum.findFirst({
    where: { slug, isPublished: true },
    include: { cover: { select: publicImageSelect }, images: { orderBy: { order: "asc" }, include: { upload: { select: publicImageSelect } } }, _count: { select: { images: true } } },
  });
  if (!row) return null;
  const images = row.images.map(toImageDTO).filter((i): i is GalleryImageDTO => i !== null);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.date ? row.date.toISOString() : null,
    cover: toPublicImage(row.cover) ?? images[0]?.image ?? null,
    imageCount: row._count.images,
    images,
  };
}

export function getPublicAlbum(slug: string): Promise<GalleryAlbumDetailDTO | null> {
  return unstable_cache(() => loadPublicAlbum(slug), ["public-gallery-album", slug], { tags: [TAGS.gallery] })();
}

async function loadGalleryHighlights(mode: "latest" | "album", albumId: string | null, maxItems: number): Promise<GalleryImageDTO[]> {
  const rows = await db.galleryImage.findMany({
    where: mode === "album" && albumId ? { albumId, album: { isPublished: true } } : { album: { isPublished: true } },
    orderBy: { createdAt: "desc" },
    take: maxItems,
    include: { upload: { select: publicImageSelect } },
  });
  return rows.map(toImageDTO).filter((i): i is GalleryImageDTO => i !== null);
}

export function getGalleryHighlights(mode: "latest" | "album", albumId: string | null, maxItems: number): Promise<GalleryImageDTO[]> {
  return unstable_cache(() => loadGalleryHighlights(mode, albumId, maxItems), ["gallery-highlights", mode, albumId ?? "", String(maxItems)], { tags: [TAGS.gallery] })();
}
```

- [ ] **Step 2: Switch the homepage section renderer to the cached loader**

Replace the whole body of `src/components/homepage/sections/gallery-highlights.tsx`:

```tsx
// src/components/homepage/sections/gallery-highlights.tsx
import { Picture } from "@/components/media/picture";
import { getGalleryHighlights } from "@/lib/data/gallery";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function GalleryHighlightsSection({ section }: { section: SectionOfType<"gallery_highlights"> }) {
  const c = section.content;
  const rows = await getGalleryHighlights(c.mode, c.albumId, c.maxItems);
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((g) => (
          <li key={g.id} className="aspect-square overflow-hidden rounded-xl bg-tile">
            <Picture image={g.image} sizes="240px" alt="" imgClassName="size-full object-cover" />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors touching `src/lib/data/gallery.ts` or `gallery-highlights.tsx`

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/gallery.ts src/components/homepage/sections/gallery-highlights.tsx
git commit -m "feat(gallery): add cached public data loader and switch gallery_highlights to it"
```

---

## Task 5: Admin nav/quick-action entries + `/admin/gallery` album list

**Files:**
- Modify: `src/components/admin/nav-items.ts`
- Modify: `src/components/admin/quick-actions.ts`
- Create: `src/app/admin/(panel)/gallery/album-list.tsx`
- Create: `src/app/admin/(panel)/gallery/page.tsx`
- Create: `src/app/admin/(panel)/gallery/new/page.tsx`
- Create: `src/app/admin/(panel)/gallery/album-form.tsx`

**Interfaces:**
- Consumes: `saveAlbumAction`, `reorderAlbumsAction` (Task 2); `useFormAction`/`fieldErrorFor`/`SaveBar` (`@/components/admin/form-state`); `PageHeader` (`@/components/admin/page-header`); `Picture` (`@/components/media/picture`); `publicImageSelect`/`toPublicImage`/`imageUrl` (`@/lib/media/public-image`); `reorderIds` (Task 1).
- Produces: `AlbumForm` component (also consumed by Task 6).

- [ ] **Step 1: Insert the nav entry**

Read `src/components/admin/nav-items.ts` first — a sibling plan may already have inserted its own line after the Sponsors row. In the import line at the top, add `Images` to the destructured `lucide-react` import (keep the rest of the list and alphabetical-ish grouping as-is, e.g. `CalendarDays, ClipboardList, FileStack, Handshake, Home, Images, LayoutDashboard, ScrollText, Settings, ShieldCheck, Users, type LucideIcon`). Then insert this line immediately after the Sponsors entry (`{ href: "/admin/sponsors", ... }`):

```ts
  { href: "/admin/gallery", label: "Gallery", icon: Images, permission: "gallery.manage", section: "Content" },
```

- [ ] **Step 2: Insert the quick action**

Read `src/components/admin/quick-actions.ts` first for the same reason. Add `Images` to the `lucide-react` import line. Insert this entry immediately after the "Add sponsor" entry:

```ts
  { href: "/admin/gallery", label: "Upload to gallery", description: "Add photos to an album", icon: Images, permission: "gallery.manage" },
```

- [ ] **Step 3: Write the drag-reorderable album list**

```tsx
// src/app/admin/(panel)/gallery/album-list.tsx
"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { ChevronRight, GripVertical } from "lucide-react";
import { useState } from "react";
import { Picture } from "@/components/media/picture";
import type { GalleryAlbumCardDTO } from "@/lib/data/gallery";
import { reorderIds } from "@/lib/gallery/reorder";
import { reorderAlbumsAction } from "@/server/actions/gallery-albums";
import { cn } from "@/lib/utils/cn";

function Row({ album }: { album: GalleryAlbumCardDTO }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: album.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-3 rounded-2xl border border-line bg-surface p-3", isDragging && "z-10 shadow-lg")}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`Reorder ${album.title}`} className="cursor-grab touch-none rounded p-1 text-muted hover:text-frost active:cursor-grabbing">
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <Link href={`/admin/gallery/${album.id}`} className="flex min-w-0 flex-1 items-center gap-4">
        <span className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-tile">
          {album.cover ? <Picture image={album.cover} sizes="80px" alt="" imgClassName="size-full object-cover" /> : <span className="text-[10px] text-night/60">No cover</span>}
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate font-semibold">{album.title}</span>
          <span className="text-sm text-muted">{album.imageCount} photo{album.imageCount === 1 ? "" : "s"}</span>
        </span>
        {!album.isPublished && <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">Draft</span>}
        <ChevronRight aria-hidden="true" className="size-4 text-muted" />
      </Link>
    </li>
  );
}

export function AlbumList({ albums }: { albums: (GalleryAlbumCardDTO & { isPublished: boolean })[] }) {
  const [items, setItems] = useState(albums);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((a) => a.id === active.id);
    const to = items.findIndex((a) => a.id === over.id);
    if (from === -1 || to === -1) return;
    const previous = items;
    const nextIds = reorderIds(items.map((a) => a.id), from, to);
    setItems(nextIds.map((id) => items.find((a) => a.id === id)!));
    setError(null);
    const result = await reorderAlbumsAction(nextIds);
    if (!result.ok) {
      setItems(previous);
      setError(result.error);
    }
  }

  return (
    <div className="grid gap-3">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <DndContext id="gallery-album-list" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-2">
            {items.map((a) => (
              <Row key={a.id} album={a} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 4: Write the album list page**

```tsx
// src/app/admin/(panel)/gallery/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { AlbumList } from "./album-list";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryAdminPage({ searchParams }: PageProps<"/admin/gallery">) {
  await requirePagePermission("gallery.manage");
  const sp = await searchParams;
  const rows = await db.galleryAlbum.findMany({
    include: { cover: { select: publicImageSelect }, images: { orderBy: { order: "asc" }, take: 1, include: { upload: { select: publicImageSelect } } }, _count: { select: { images: true } } },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  const albums = rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    date: a.date ? a.date.toISOString() : null,
    cover: toPublicImage(a.cover) ?? toPublicImage(a.images[0]?.upload),
    imageCount: a._count.images,
    isPublished: a.isPublished,
  }));
  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader
        eyebrow="Content"
        title="Gallery"
        description="Photo albums shown on the public gallery. Drag to reorder."
        actions={
          <Link href="/admin/gallery/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            <Plus className="size-4" aria-hidden="true" /> New album
          </Link>
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Album deleted.
        </p>
      )}
      {albums.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">No albums yet.</p>
          <Link href="/admin/gallery/new" className="text-sm text-leaf hover:underline">
            Create the first one
          </Link>
        </div>
      ) : (
        <AlbumList albums={albums} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Write the shared album form**

```tsx
// src/app/admin/(panel)/gallery/album-form.tsx
"use client";

import Link from "next/link";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Panel } from "@/components/admin/page-header";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteAlbumAction, saveAlbumAction } from "@/server/actions/gallery-albums";

export type AlbumValues = {
  id: string | null;
  title: string;
  description: string;
  date: string;
  eventId: string | null;
  isPublished: boolean;
};

export function AlbumForm({ values, events }: { values: AlbumValues; events: { id: string; title: string }[] }) {
  const { state, pending, onSubmit } = useFormAction(saveAlbumAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" error={err("title")} className="sm:col-span-2">
            <Input id="title" name="title" defaultValue={values.title} maxLength={100} required {...describedBy("title", err("title"))} />
          </Field>
          <Field label="Date" htmlFor="date" error={err("date")} hint="Optional — shown on the album card.">
            <Input id="date" name="date" type="date" defaultValue={values.date} />
          </Field>
          <Field label="Linked event" htmlFor="eventId" error={err("eventId")} hint="Optional — lets visitors jump between the event and its photos.">
            <Select id="eventId" name="eventId" defaultValue={values.eventId ?? ""}>
              <option value="">No linked event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="description" error={err("description")} className="sm:col-span-2">
            <Textarea id="description" name="description" rows={3} defaultValue={values.description} maxLength={500} />
          </Field>
        </div>
        <Switch name="isPublished" label="Published (visible on the public gallery)" defaultChecked={values.isPublished} />
      </Panel>
      <SaveBar state={state} pending={pending} label={values.id ? "Save album" : "Create album"} />
    </form>
  );
}

export function DeleteAlbumForm({ id, imageCount }: { id: string; imageCount: number }) {
  const { state, pending, onSubmit } = useFormAction(deleteAlbumAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit label="Delete album" confirmLabel={imageCount ? `Delete and remove ${imageCount} photo${imageCount === 1 ? "" : "s"}` : "Delete permanently"} disabled={pending} />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}

export function BackToGallery() {
  return (
    <Link href="/admin/gallery" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
      ← All albums
    </Link>
  );
}
```

- [ ] **Step 6: Write the "new album" page**

```tsx
// src/app/admin/(panel)/gallery/new/page.tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { AlbumForm, BackToGallery } from "../album-form";

export const metadata: Metadata = { title: "New album" };

export default async function NewAlbumPage() {
  await requirePagePermission("gallery.manage");
  const events = await db.event.findMany({ select: { id: true, title: true }, orderBy: { startAt: "desc" }, take: 200 });
  return (
    <div className="grid max-w-3xl gap-8">
      <BackToGallery />
      <PageHeader eyebrow="Gallery" title="New album" />
      <AlbumForm values={{ id: null, title: "", description: "", date: "", eventId: null, isPublished: false }} events={events} />
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors in the new files (the `[id]` route referenced by `AlbumList`/`BackToGallery` links doesn't exist until Task 6, which does not affect typecheck)

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/nav-items.ts src/components/admin/quick-actions.ts "src/app/admin/(panel)/gallery/album-list.tsx" "src/app/admin/(panel)/gallery/page.tsx" "src/app/admin/(panel)/gallery/new/page.tsx" "src/app/admin/(panel)/gallery/album-form.tsx"
git commit -m "feat(gallery): add admin nav/quick-action entries and album list + create page"
```

---

## Task 6: `/admin/gallery/[id]` album detail shell

**Files:**
- Create: `src/app/admin/(panel)/gallery/[id]/page.tsx`

**Interfaces:**
- Consumes: `AlbumForm`, `DeleteAlbumForm`, `BackToGallery` (Task 5); `formatAlbumDate` (Task 1). Task 7 and Task 8 add the bulk-upload and image-grid panels into this same page (both edits are additive `<Panel>` blocks below the delete panel, described in those tasks).

- [ ] **Step 1: Write the album detail page**

```tsx
// src/app/admin/(panel)/gallery/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { formatAlbumDate } from "@/lib/gallery/schema";
import { AlbumForm, BackToGallery, DeleteAlbumForm } from "../album-form";

export const metadata: Metadata = { title: "Edit album" };

export default async function EditAlbumPage({ params, searchParams }: PageProps<"/admin/gallery/[id]">) {
  await requirePagePermission("gallery.manage");
  const { id } = await params;
  const sp = await searchParams;
  const [album, events] = await Promise.all([
    db.galleryAlbum.findUnique({ where: { id }, include: { _count: { select: { images: true } } } }),
    db.event.findMany({ select: { id: true, title: true }, orderBy: { startAt: "desc" }, take: 200 }),
  ]);
  if (!album) notFound();

  return (
    <div className="grid max-w-3xl gap-8">
      <BackToGallery />
      <PageHeader eyebrow="Gallery" title={album.title} />
      {sp.created && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Album created. Add photos below.
        </p>
      )}
      <AlbumForm
        values={{
          id: album.id,
          title: album.title,
          description: album.description,
          date: formatAlbumDate(album.date),
          eventId: album.eventId,
          isPublished: album.isPublished,
        }}
        events={events}
      />
      <Panel title="Delete album" description="Removes the album and every photo in it.">
        <DeleteAlbumForm id={album.id} imageCount={album._count.images} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(panel)/gallery/[id]/page.tsx"
git commit -m "feat(gallery): add album detail page shell"
```

---

## Task 7: Bulk upload component

**Files:**
- Create: `src/app/admin/(panel)/gallery/bulk-upload.tsx`
- Modify: `src/app/admin/(panel)/gallery/[id]/page.tsx`

**Interfaces:**
- Consumes: `addGalleryImagesAction` (Task 3); `/api/admin/uploads` (existing route, `purpose: "GALLERY"`, no crop since `PURPOSE_RULES.GALLERY.aspect` is undefined); `can` (`@/lib/auth/guard`).
- Produces: `BulkUpload` client component, taking `albumId: string` and rendered from the album detail page only when the signed-in user has `media.upload`.

Per-file progress uses `XMLHttpRequest.upload.onprogress` (plain `fetch` has no upload-progress event). Files upload with a concurrency cap of 3 at a time — `uploadLimiter` allows 60/min per admin, well above what a 3-wide queue can produce, so the cap is for perceived responsiveness, not to dodge the limiter. "Add to album" stays disabled until every non-errored file has non-empty alt text.

- [ ] **Step 1: Write the bulk upload component**

```tsx
// src/app/admin/(panel)/gallery/bulk-upload.tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addGalleryImagesAction } from "@/server/actions/gallery-images";
import { cn } from "@/lib/utils/cn";

type FileItem = {
  key: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "needs-alt" | "error";
  progress: number;
  uploadId: string | null;
  alt: string;
  error: string | null;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 15 * 1024 * 1024;
const CONCURRENCY = 3;

function uploadOne(file: File, onProgress: (pct: number) => void): Promise<{ id: string; url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/uploads");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let json: { id?: string; url?: string; error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // ignore malformed body, handled by the status check below
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.id && json.url) resolve({ id: json.id, url: json.url });
      else reject(new Error(json.error ?? "Upload failed. Try again."));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "GALLERY");
    body.set("alt", "");
    xhr.send(body);
  });
}

export function BulkUpload({ albumId }: { albumId: string }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const activeRef = useRef(0);

  const runUpload = useCallback((item: FileItem) => {
    setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: "uploading", progress: 0 } : i)));
    uploadOne(item.file, (pct) => setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, progress: pct } : i))))
      .then(({ id }) => {
        setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: "needs-alt", uploadId: id, progress: 100 } : i)));
      })
      .catch((e: Error) => {
        setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, status: "error", error: e.message } : i)));
      });
  }, []);

  function enqueue(item: FileItem) {
    queueRef.current = queueRef.current.then(async () => {
      while (activeRef.current >= CONCURRENCY) await new Promise((r) => setTimeout(r, 50));
      activeRef.current += 1;
      runUpload(item);
      // Release the concurrency slot once this item leaves the "uploading" state (poll, since runUpload is fire-and-forget).
      while (true) {
        await new Promise((r) => setTimeout(r, 100));
        const current = items.find((i) => i.key === item.key);
        if (!current || current.status !== "uploading") break;
      }
      activeRef.current -= 1;
    });
  }

  function onFilesChosen(files: FileList | null) {
    if (input.current) input.current.value = "";
    if (!files) return;
    const next: FileItem[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPT.split(",").includes(file.type)) continue;
      if (file.size > MAX_BYTES) continue;
      next.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, previewUrl: URL.createObjectURL(file), status: "uploading", progress: 0, uploadId: null, alt: "", error: null });
    }
    setItems((prev) => [...prev, ...next]);
    for (const item of next) enqueue(item);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function retryItem(key: string) {
    const item = items.find((i) => i.key === key);
    if (item) enqueue({ ...item, status: "uploading", error: null });
  }

  const ready = items.filter((i) => i.status === "needs-alt" && i.uploadId);
  const canAdd = ready.length > 0 && ready.every((i) => i.alt.trim().length > 0) && !items.some((i) => i.status === "uploading");

  async function addToAlbum() {
    setAdding(true);
    setAddError(null);
    const result = await addGalleryImagesAction(
      albumId,
      ready.map((i) => ({ uploadId: i.uploadId!, alt: i.alt.trim() })),
    );
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setItems((prev) => prev.filter((i) => !ready.some((r) => r.key === i.key)));
    window.location.reload();
  }

  return (
    <div className="grid gap-4">
      <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => onFilesChosen(e.target.files)} />
      <Button type="button" variant="secondary" onClick={() => input.current?.click()} className="justify-self-start">
        <ImagePlus className="size-4" aria-hidden="true" /> Choose photos
      </Button>
      <p className="text-xs text-muted">JPG, PNG, WebP or AVIF, up to 15 MB each. Every photo needs alt text before it's added.</p>

      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.key} className="grid gap-2 rounded-xl border border-line bg-night p-3">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview before upload completes */}
                <img src={item.previewUrl} alt="" className="size-full object-cover" />
                {item.status === "uploading" && (
                  <span className="absolute inset-0 grid place-items-center bg-night/70" role="status">
                    <Loader2 aria-hidden="true" className="size-6 animate-spin text-leaf" />
                    <span className="sr-only">Uploading, {item.progress}%…</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted">{item.file.name}</span>
                <button type="button" onClick={() => removeItem(item.key)} aria-label={`Remove ${item.file.name}`} className="shrink-0 rounded p-1 text-muted hover:text-danger">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              {item.status === "error" && (
                <div className="flex items-center gap-2 text-xs text-danger">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.error}</span>
                  <button type="button" onClick={() => retryItem(item.key)} className="underline">
                    Retry
                  </button>
                </div>
              )}
              {item.status === "needs-alt" && (
                <Input
                  value={item.alt}
                  onChange={(e) => setItems((prev) => prev.map((i) => (i.key === item.key ? { ...i, alt: e.target.value } : i)))}
                  placeholder="Alt text (required)"
                  maxLength={300}
                  aria-label={`Alt text for ${item.file.name}`}
                  className={cn(!item.alt.trim() && "border-amber/50")}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!canAdd || adding} onClick={() => void addToAlbum()}>
            {adding && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            Add {ready.length || ""} photo{ready.length === 1 ? "" : "s"} to album
          </Button>
          {addError && <p role="alert" className="text-sm text-danger">{addError}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the album detail page, gated on `media.upload`**

In `src/app/admin/(panel)/gallery/[id]/page.tsx`, change the import of `requirePagePermission` to also import `can`, add the `BulkUpload` import, and insert a new Panel between `<AlbumForm .../>` and the "Delete album" Panel:

```ts
import { can, requirePagePermission } from "@/lib/auth/guard";
```

```ts
import { BulkUpload } from "../bulk-upload";
```

```tsx
      <Panel title="Add photos" description="Upload one or more photos to this album.">
        {can(user, "media.upload") ? (
          <BulkUpload albumId={album.id} />
        ) : (
          <p className="text-sm text-muted">You need the media upload permission to add photos.</p>
        )}
      </Panel>
```

Change `await requirePagePermission("gallery.manage");` to `const user = await requirePagePermission("gallery.manage");` so `user` is available for the `can()` check.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(panel)/gallery/bulk-upload.tsx" "src/app/admin/(panel)/gallery/[id]/page.tsx"
git commit -m "feat(gallery): add bulk photo upload with per-file progress and required alt text"
```

---

## Task 8: Image grid (captions, set-as-cover, delete, reorder)

**Files:**
- Create: `src/app/admin/(panel)/gallery/image-grid.tsx`
- Modify: `src/app/admin/(panel)/gallery/[id]/page.tsx`

**Interfaces:**
- Consumes: `updateGalleryImageAction`, `reorderGalleryImagesAction`, `deleteGalleryImageAction` (Task 3); `setAlbumCoverAction` (Task 2); `reorderIds` (Task 1); `imageUrl` (`@/lib/media/public-image`).

- [ ] **Step 1: Write the image grid component**

```tsx
// src/app/admin/(panel)/gallery/image-grid.tsx
"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteGalleryImageAction, reorderGalleryImagesAction, updateGalleryImageAction } from "@/server/actions/gallery-images";
import { setAlbumCoverAction } from "@/server/actions/gallery-albums";
import { reorderIds } from "@/lib/gallery/reorder";
import { cn } from "@/lib/utils/cn";

export type GridImage = { id: string; uploadId: string; url: string; alt: string; caption: string };

function Tile({
  image,
  isCover,
  onSetCover,
  onDelete,
  onCaptionChange,
}: {
  image: GridImage;
  isCover: boolean;
  onSetCover: () => void;
  onDelete: () => void;
  onCaptionChange: (caption: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  const [caption, setCaption] = useState(image.caption);
  const [saved, setSaved] = useState(true);
  const [confirming, setConfirming] = useState(false);

  async function saveCaption() {
    if (saved) return;
    const result = await updateGalleryImageAction("", image.id, caption); // albumId is validated server-side against the image's own row
    if (result.ok) {
      setSaved(true);
      onCaptionChange(caption);
    }
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("grid gap-2 rounded-xl border border-line bg-night p-2", isDragging && "z-10 shadow-lg")}>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of an already-resolved variant */}
        <img src={image.url} alt={image.alt} className="size-full object-cover" />
        <button type="button" {...attributes} {...listeners} aria-label="Reorder photo" className="absolute left-1.5 top-1.5 rounded-full bg-night/70 p-1.5 text-frost">
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        {isCover && (
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-leaf/90 px-2 py-0.5 text-[11px] font-semibold text-night">
            <Star className="size-3" aria-hidden="true" /> Cover
          </span>
        )}
      </div>
      <Input
        value={caption}
        onChange={(e) => {
          setCaption(e.target.value);
          setSaved(false);
        }}
        onBlur={() => void saveCaption()}
        placeholder="Caption (optional)"
        maxLength={200}
        aria-label="Caption"
      />
      <div className="flex flex-wrap items-center gap-2">
        {!isCover && (
          <Button type="button" variant="ghost" size="sm" onClick={onSetCover}>
            Set as cover
          </Button>
        )}
        {!confirming ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            <Trash2 className="size-3.5" aria-hidden="true" /> Remove
          </Button>
        ) : (
          <span className="inline-flex gap-1.5">
            <Button type="button" variant="danger" size="sm" onClick={onDelete}>
              Confirm
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}

export function ImageGrid({ albumId, coverId, images }: { albumId: string; coverId: string | null; images: GridImage[] }) {
  const [items, setItems] = useState(images);
  const [cover, setCover] = useState(coverId);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    const previous = items;
    const nextIds = reorderIds(items.map((i) => i.id), from, to);
    setItems(nextIds.map((id) => items.find((i) => i.id === id)!));
    const result = await reorderGalleryImagesAction(albumId, nextIds);
    if (!result.ok) {
      setItems(previous);
      setError(result.error);
    }
  }

  async function handleSetCover(uploadId: string) {
    const previous = cover;
    setCover(uploadId);
    const result = await setAlbumCoverAction(albumId, uploadId);
    if (!result.ok) {
      setCover(previous);
      setError(result.error);
    }
  }

  async function handleDelete(imageId: string) {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== imageId));
    const result = await deleteGalleryImageAction(albumId, imageId);
    if (!result.ok) {
      setItems(previous);
      setError(result.error);
    }
  }

  if (items.length === 0) return <p className="text-sm text-muted">No photos in this album yet.</p>;

  return (
    <div className="grid gap-3">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <DndContext id="gallery-image-grid" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((image) => (
              <Tile
                key={image.id}
                image={image}
                isCover={cover === image.uploadId}
                onSetCover={() => void handleSetCover(image.uploadId)}
                onDelete={() => void handleDelete(image.id)}
                onCaptionChange={(caption) => setItems((prev) => prev.map((i) => (i.id === image.id ? { ...i, caption } : i)))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

- [ ] **Step 2: Fix the caption action call to pass the real albumId**

The `Tile` component above calls `updateGalleryImageAction("", image.id, caption)` with an empty albumId as a placeholder note — replace it with the real value by threading `albumId` down from `ImageGrid` to `Tile`. Edit `image-grid.tsx`:

```tsx
function Tile({
  albumId,
  image,
  isCover,
  onSetCover,
  onDelete,
  onCaptionChange,
}: {
  albumId: string;
  image: GridImage;
  isCover: boolean;
  onSetCover: () => void;
  onDelete: () => void;
  onCaptionChange: (caption: string) => void;
}) {
```

```tsx
  async function saveCaption() {
    if (saved) return;
    const result = await updateGalleryImageAction(albumId, image.id, caption);
    if (result.ok) {
      setSaved(true);
      onCaptionChange(caption);
    }
  }
```

And in `ImageGrid`'s render, pass `albumId={albumId}` to `<Tile ... />`.

- [ ] **Step 3: Wire the grid into the album detail page**

In `src/app/admin/(panel)/gallery/[id]/page.tsx`, fetch the album's images and pass them to `ImageGrid`. Add the import:

```ts
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { ImageGrid } from "../image-grid";
```

Change the album query to include images, and build the grid's props:

```ts
  const [album, events] = await Promise.all([
    db.galleryAlbum.findUnique({
      where: { id },
      include: { _count: { select: { images: true } }, images: { orderBy: { order: "asc" }, include: { upload: { select: publicImageSelect } } } },
    }),
    db.event.findMany({ select: { id: true, title: true }, orderBy: { startAt: "desc" }, take: 200 }),
  ]);
  if (!album) notFound();
  const gridImages = album.images
    .map((gi) => {
      const image = toPublicImage(gi.upload);
      return image ? { id: gi.id, uploadId: gi.uploadId, url: imageUrl(image, 480), alt: image.alt, caption: gi.caption } : null;
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);
```

Add a Panel between "Add photos" and "Delete album":

```tsx
      <Panel title={`Photos (${album._count.images})`}>
        <ImageGrid albumId={album.id} coverId={album.coverId} images={gridImages} />
      </Panel>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/gallery/image-grid.tsx" "src/app/admin/(panel)/gallery/[id]/page.tsx"
git commit -m "feat(gallery): add image grid with captions, cover picking, reorder and delete"
```

---

## Task 9: Public `/gallery` page + page-toggle registration + sitemap

**Files:**
- Create: `src/app/(site)/gallery/page.tsx`
- Modify: `src/lib/pages/registry.ts`
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `getPublicAlbums` (Task 4); `assertPageEnabled` (`@/lib/data/pages`); `metadataForPage` (`@/lib/seo`); `Picture` (`@/components/media/picture`).

- [ ] **Step 1: Flip `IMPLEMENTED_PAGES`**

Read `src/lib/pages/registry.ts` first (5a/5b may already have added `"ANNOUNCEMENTS"` / `"TEAM"` to the same `Set` literal). Add `"GALLERY"` to the `new Set<PageKey>([...])` literal in `IMPLEMENTED_PAGES`, keeping every existing entry:

```ts
export const IMPLEMENTED_PAGES: ReadonlySet<PageKey> = new Set<PageKey>(["HOME", "EVENTS", "SPONSORS", "ABOUT", "CONTACT", "GALLERY"]);
```

(If a sibling plan already added `"ANNOUNCEMENTS"` or `"TEAM"`, keep those too — just add `"GALLERY"` to whatever list is already there.)

- [ ] **Step 2: Write the public gallery list page**

```tsx
// src/app/(site)/gallery/page.tsx
import Link from "next/link";
import { Picture } from "@/components/media/picture";
import { Rings } from "@/components/site/rings";
import { Spotlight } from "@/components/site/spotlight";
import { getPublicAlbums } from "@/lib/data/gallery";
import { assertPageEnabled } from "@/lib/data/pages";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("GALLERY", { title: "Gallery", description: "Photos from our workshops, hackathons and meetups." });
}

export default async function GalleryPage() {
  const page = await assertPageEnabled("GALLERY");
  const albums = await getPublicAlbums();

  return (
    <div className="relative isolate">
      <Rings className="pointer-events-none absolute -right-60 -top-40 -z-10 size-[720px] opacity-40" />
      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">Moments from the chapter</h1>
        <p className="max-w-2xl text-lg text-muted">Photos from our workshops, hackathons and meetups, album by album.</p>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {albums.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Photos from our events will be posted here soon.</p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((a, i) => (
              <li key={a.id}>
                <Spotlight className="reveal h-full rounded-3xl">
                  <Link href={`/gallery/${a.slug}`} className="grid h-full content-start gap-3 rounded-3xl border border-line bg-surface p-4">
                    <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-tile">
                      {a.cover ? (
                        <Picture image={a.cover} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" priority={i < 3} alt="" imgClassName="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-sm text-night/60">No photos yet</span>
                      )}
                    </div>
                    <div className="grid gap-1 px-1 pb-2">
                      <h2 className="font-semibold">{a.title}</h2>
                      <p className="text-sm text-muted">
                        {a.imageCount} photo{a.imageCount === 1 ? "" : "s"}
                        {a.date ? ` · ${new Date(a.date).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}` : ""}
                      </p>
                    </div>
                  </Link>
                </Spotlight>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add sitemap entries**

Read `src/app/sitemap.ts` first — a sibling plan may already have added its own `if (live(...))` block. Add this import next to the other `getPublic*` imports:

```ts
import { getPublicAlbums } from "@/lib/data/gallery";
```

Add this block after the `if (live("EVENTS")) { ... }` block (before `return entries;`):

```ts
  if (live("GALLERY")) {
    for (const a of await getPublicAlbums()) {
      entries.push({ url: `${base}/gallery/${a.slug}`, changeFrequency: "monthly", priority: 0.5 });
    }
  }
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add "src/app/(site)/gallery/page.tsx" src/lib/pages/registry.ts src/app/sitemap.ts
git commit -m "feat(gallery): add public gallery list page, enable the page toggle, extend sitemap"
```

---

## Task 10: Public `/gallery/[album]` masonry page

**Files:**
- Create: `src/app/(site)/gallery/[album]/page.tsx`

**Interfaces:**
- Consumes: `getPublicAlbum` (Task 4); Task 11's `Lightbox` component (imported here; write Task 11 immediately after, or stub-free since this task only renders thumbnails as `<button>`s — the lightbox wiring itself happens in Task 11's edit to this same file).

This task renders the masonry grid as plain `<button>` thumbnails (no interactivity yet, keyboard-focusable, `aria-label` per photo). Task 11 adds the `Lightbox` and click/keyboard wiring on top.

- [ ] **Step 1: Write the album detail page**

```tsx
// src/app/(site)/gallery/[album]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Picture } from "@/components/media/picture";
import { assertPageEnabled } from "@/lib/data/pages";
import { getPublicAlbum } from "@/lib/data/gallery";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/gallery/[album]">): Promise<Metadata> {
  const { album: slug } = await params;
  const album = await getPublicAlbum(slug);
  if (!album) return metadataForPage("GALLERY", { title: "Gallery", description: "Photos from our events." });
  return metadataForPage("GALLERY", { title: album.title, description: album.description || `${album.imageCount} photos from ${album.title}.` });
}

export default async function GalleryAlbumPage({ params }: PageProps<"/gallery/[album]">) {
  await assertPageEnabled("GALLERY");
  const { album: slug } = await params;
  const album = await getPublicAlbum(slug);
  if (!album) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <Link href="/gallery" className="text-sm text-leaf hover:underline">
        ← All albums
      </Link>
      <header className="mt-4 grid gap-3">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{album.title}</h1>
        {album.description && <p className="max-w-2xl text-lg text-muted">{album.description}</p>}
        <p className="text-sm text-muted">
          {album.imageCount} photo{album.imageCount === 1 ? "" : "s"}
          {album.date ? ` · ${new Date(album.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}` : ""}
        </p>
      </header>

      {album.images.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">No photos in this album yet.</p>
      ) : (
        <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {album.images.map((img) => (
            <button
              key={img.id}
              type="button"
              aria-label={img.caption || img.image.alt || `Photo ${album.images.indexOf(img) + 1} of ${album.images.length}`}
              className="block w-full overflow-hidden rounded-2xl border border-line bg-tile transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              <Picture image={img.image} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" alt={img.caption || img.image.alt} imgClassName="w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add "src/app/(site)/gallery/[album]/page.tsx"
git commit -m "feat(gallery): add public album page with CSS masonry layout"
```

---

## Task 11: Accessible lightbox

**Files:**
- Create: `src/components/gallery/lightbox.tsx`
- Modify: `src/app/(site)/gallery/[album]/page.tsx`

**Interfaces:**
- Consumes: `wrapIndex` (Task 1); the `GalleryAlbumDetailDTO["images"]` shape from Task 4; `Picture` (`@/components/media/picture`).

The lightbox is the only client island on this route (dnd-kit and other admin-only libraries stay out of it). It uses the native `<dialog>` + `showModal()` pattern already established in `ImageUploadField` (Esc-to-close and focus containment come from the browser), adds ArrowLeft/ArrowRight handling, returns focus to the thumbnail that opened it, and uses the `motion-reduce:` Tailwind variant so the fade/scale transition collapses to instant under `prefers-reduced-motion`.

- [ ] **Step 1: Write the lightbox component**

```tsx
// src/components/gallery/lightbox.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Picture } from "@/components/media/picture";
import type { GalleryImageDTO } from "@/lib/data/gallery";
import { wrapIndex } from "@/lib/gallery/lightbox";

export function Lightbox({ images, albumTitle }: { images: GalleryImageDTO[]; albumTitle: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  function open(index: number, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setOpenIndex(index);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
    setOpenIndex(null);
    triggerRef.current?.focus();
  }

  function go(delta: 1 | -1) {
    setOpenIndex((i) => (i === null ? i : wrapIndex(i, images.length, delta)));
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (openIndex === null) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openIndex, images.length]);

  const current = openIndex !== null ? images[openIndex] : null;

  return (
    <>
      <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={(e) => open(i, e.currentTarget)}
            aria-label={img.caption || img.image.alt || `Photo ${i + 1} of ${images.length}, from ${albumTitle}`}
            className="block w-full overflow-hidden rounded-2xl border border-line bg-tile transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
          >
            <Picture image={img.image} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" alt={img.caption || img.image.alt} imgClassName="w-full object-cover" />
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        aria-label={current ? current.caption || current.image.alt || albumTitle : albumTitle}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClose={() => setOpenIndex(null)}
        className="m-auto w-[min(1100px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] rounded-2xl border border-line bg-night p-0 text-frost backdrop:bg-night/90 motion-safe:transition-opacity motion-reduce:transition-none"
      >
        {current && (
          <div className="grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {openIndex! + 1} / {images.length}
              </p>
              <button type="button" onClick={close} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-raised hover:text-frost">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="relative grid place-items-center">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous photo"
                className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-night/70 p-2 text-frost hover:bg-night/90"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <Picture image={current.image} sizes="1100px" alt={current.caption || current.image.alt} priority className="max-h-[70vh] w-full" imgClassName="mx-auto max-h-[70vh] w-auto object-contain" />
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next photo"
                className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-night/70 p-2 text-frost hover:bg-night/90"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </div>
            {current.caption && <p className="text-center text-sm text-muted">{current.caption}</p>}
          </div>
        )}
      </dialog>
    </>
  );
}
```

- [ ] **Step 2: Replace the static grid on the album page with the lightbox**

In `src/app/(site)/gallery/[album]/page.tsx`, remove the `import { Picture } from "@/components/media/picture";` line (no longer used directly there) and the whole masonry `<div>` block from Task 10 Step 1, replacing it with:

```ts
import { Lightbox } from "@/components/gallery/lightbox";
```

```tsx
      {album.images.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">No photos in this album yet.</p>
      ) : (
        <Lightbox images={album.images} albumTitle={album.title} />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in as an admin with `gallery.manage`, create a published album with at least 3 photos, then visit `/gallery/[slug]`. Confirm: clicking a thumbnail opens the dialog, Esc closes it and returns focus to the thumbnail, ArrowLeft/ArrowRight move between photos and wrap at the ends, and with OS-level "reduce motion" enabled the dialog opens without a fade.

- [ ] **Step 5: Commit**

```bash
git add src/components/gallery/lightbox.tsx "src/app/(site)/gallery/[album]/page.tsx"
git commit -m "feat(gallery): add keyboard-navigable lightbox with focus return and reduced-motion support"
```

---

## Task 12: Shared `ImagePicker` (upload new or choose existing)

**Files:**
- Create: `src/components/admin/image-picker.tsx`
- Modify: `src/server/actions/homepage.ts`

**Interfaces:**
- Produces: `ImagePicker` component with props `{ uploadId: string | null; url: string | null; alt: string; onChange: (uploadId: string, url: string, alt: string) => void }`; `updateHomepageImageAltAction(uploadId: string, alt: string): Promise<ActionResult>`; `listImageLibraryAction(): Promise<ActionResult<{ id: string; url: string; alt: string }[]>>`. Consumed by Task 13 (About) and Task 14 (Achievements).
- Leaves `src/app/admin/(panel)/forms/[id]/build/inspector.tsx`'s own `ImagePicker` untouched — this is a new, separate component, not a shared import, to avoid coupling the forms builder to homepage permissions.

- [ ] **Step 1: Add the two homepage-scoped actions**

Append to `src/server/actions/homepage.ts` (after the last existing export, `restoreHomepageRevisionAction`):

```ts
export async function updateHomepageImageAltAction(uploadId: string, alt: string): Promise<ActionResult> {
  return runAction(async () => {
    await requirePermission("homepage.edit");
    const { count } = await db.upload.updateMany({ where: { id: uploadId, kind: "IMAGE", visibility: "PUBLIC" }, data: { alt: alt.trim().slice(0, 300) } });
    if (!count) throw new UserError("That image is no longer available.");
    return null;
  });
}

export async function listImageLibraryAction(): Promise<ActionResult<{ id: string; url: string; alt: string }[]>> {
  return runAction(async () => {
    await requirePermission("homepage.edit");
    const uploads = await db.upload.findMany({
      where: { kind: "IMAGE", visibility: "PUBLIC", purpose: { in: ["GENERIC", "GALLERY"] } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, alt: true, storageKey: true, width: true, height: true, blurDataUrl: true, variants: true, visibility: true },
    });
    return uploads
      .map((u) => {
        const image = toPublicImage(u);
        return image ? { id: u.id, url: imageUrl(image, 320), alt: u.alt } : null;
      })
      .filter((i): i is { id: string; url: string; alt: string } => i !== null);
  });
}
```

Add the needed imports to the top of `src/server/actions/homepage.ts`:

```ts
import { imageUrl, toPublicImage } from "@/lib/media/public-image";
```

- [ ] **Step 2: Write the picker component**

```tsx
// src/components/admin/image-picker.tsx
"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Library, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { listImageLibraryAction, updateHomepageImageAltAction } from "@/server/actions/homepage";
import { cn } from "@/lib/utils/cn";

/** Uploads a new image (GENERIC purpose, any shape) or picks one already in the media library. Used by the homepage About and Achievements section forms. */
export function ImagePicker({
  uploadId,
  url,
  alt,
  onChange,
}: {
  uploadId: string | null;
  url: string | null;
  alt: string;
  onChange: (uploadId: string, url: string, alt: string) => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [altValue, setAltValue] = useState(alt);
  const [altSaved, setAltSaved] = useState(true);
  const [library, setLibrary] = useState<{ id: string; url: string; alt: string }[] | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "GENERIC");
    body.set("alt", "");
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: string };
      if (!res.ok || !json.id || !json.url) throw new Error(json.error ?? "Upload failed. Try again.");
      setAltValue("");
      onChange(json.id, json.url, "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function saveAlt() {
    if (!uploadId || altSaved) return;
    const result = await updateHomepageImageAltAction(uploadId, altValue);
    if (result.ok) {
      setAltSaved(true);
      onChange(uploadId, url ?? "", altValue);
    }
  }

  async function openLibrary() {
    dialog.current?.showModal();
    if (library) return;
    setLibraryLoading(true);
    setLibraryError(null);
    const result = await listImageLibraryAction();
    setLibraryLoading(false);
    if (result.ok) setLibrary(result.data);
    else setLibraryError(result.error);
  }

  function pick(item: { id: string; url: string; alt: string }) {
    dialog.current?.close();
    setAltValue(item.alt);
    onChange(item.id, item.url, item.alt);
  }

  return (
    <div className="grid gap-3">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of the resolved public variant
        <img src={url} alt="" className="aspect-video w-full rounded-lg border border-line bg-night object-cover" />
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
          {uploadId ? "Replace image" : "Upload image"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void openLibrary()}>
          <Library className="size-4" aria-hidden="true" /> Choose existing
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {uploadId && (
        <Field label="Alt text" htmlFor={`${id}-alt`} hint="Describes the image for screen readers.">
          <Input
            id={`${id}-alt`}
            value={altValue}
            onChange={(e) => {
              setAltValue(e.target.value);
              setAltSaved(false);
            }}
            onBlur={() => void saveAlt()}
            maxLength={300}
          />
        </Field>
      )}

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-library-title`}
        onCancel={(e) => {
          e.preventDefault();
          dialog.current?.close();
        }}
        className="m-auto w-[min(720px,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] rounded-2xl border border-line bg-surface p-0 text-frost backdrop:bg-night/80"
      >
        <div className="grid gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`${id}-library-title`} className="font-display text-lg font-semibold">
              Choose an image
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => dialog.current?.close()}>
              Close
            </Button>
          </div>
          {libraryLoading && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
            </p>
          )}
          {libraryError && (
            <p role="alert" className="text-sm text-danger">
              {libraryError}
            </p>
          )}
          {library && library.length === 0 && <p className="text-sm text-muted">No uploaded images yet — upload one instead.</p>}
          {library && library.length > 0 && (
            <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {library.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pick(item)}
                  className={cn("aspect-square overflow-hidden rounded-lg border border-line bg-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint", item.id === uploadId && "ring-2 ring-leaf")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnail */}
                  <img src={item.url} alt={item.alt} className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/image-picker.tsx src/server/actions/homepage.ts
git commit -m "feat(homepage): add shared image picker (upload or choose existing) for section forms"
```

---

## Task 13: Wire the About section's image picker

**Files:**
- Modify: `src/lib/data/homepage.ts`
- Modify: `src/app/admin/(panel)/homepage/page.tsx`
- Modify: `src/app/admin/(panel)/homepage/homepage-builder.tsx`
- Modify: `src/app/admin/(panel)/homepage/inspector.tsx`
- Modify: `src/app/admin/(panel)/homepage/section-forms/about.tsx`

**Interfaces:**
- Consumes: `resolveHomepageImages` (existing, `src/lib/data/homepage.ts`); `imageUrl` (`@/lib/media/public-image`); `ImagePicker` (Task 12).
- Produces: `images: Record<string, { url: string; alt: string }>` prop threaded `page.tsx → HomepageBuilder → Inspector → AboutForm`; `registerImage(id, { url, alt })` callback threaded the same way, letting a freshly uploaded/picked image show its preview immediately without a full reload.

- [ ] **Step 1: Export a URL-mapping helper next to `resolveHomepageImages`**

Add to `src/lib/data/homepage.ts` (after `resolveHomepageImages`), and add `imageUrl` to its existing `@/lib/media/public-image` import:

```ts
import { imageUrl, publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";
```

```ts
export type HomepageImageDTO = { url: string; alt: string };

/** `resolveHomepageImages`'s PublicImage map, flattened to what the admin picker needs. */
export async function resolveHomepageImageUrls(sections: HomepageSections): Promise<Record<string, HomepageImageDTO>> {
  const images = await resolveHomepageImages(sections);
  const out: Record<string, HomepageImageDTO> = {};
  for (const [id, img] of Object.entries(images)) out[id] = { url: imageUrl(img, 800), alt: img.alt };
  return out;
}
```

- [ ] **Step 2: Resolve and pass images from the page**

Edit `src/app/admin/(panel)/homepage/page.tsx`:

```ts
import { loadDraftHomepage, loadHomepageHistory, resolveHomepageImageUrls } from "@/lib/data/homepage";
```

```ts
  const [draft, history] = await Promise.all([loadDraftHomepage(), loadHomepageHistory()]);
  const images = await resolveHomepageImageUrls(draft.sections);
```

```tsx
      <HomepageBuilder revisionId={draft.id} initialSections={draft.sections} initialImages={images} canPublish={can(user, "homepage.publish")} history={history} />
```

- [ ] **Step 3: Thread `images` state through the builder**

Edit `src/app/admin/(panel)/homepage/homepage-builder.tsx`. Add `HomepageImageDTO` to the import from `@/lib/data/homepage`:

```ts
import type { HomepageHistoryEntry, HomepageImageDTO } from "@/lib/data/homepage";
```

Add `initialImages` to the props type and destructuring:

```ts
export function HomepageBuilder({
  revisionId,
  initialSections,
  initialImages,
  canPublish,
  history,
}: {
  revisionId: string;
  initialSections: HomepageSections;
  initialImages: Record<string, HomepageImageDTO>;
  canPublish: boolean;
  history: HomepageHistoryEntry[];
}) {
```

Add image state next to the existing `sections` state:

```ts
  const [images, setImages] = useState(initialImages);
  const registerImage = useCallback((id: string, image: HomepageImageDTO) => setImages((prev) => ({ ...prev, [id]: image })), []);
```

Find the `<Inspector section={...} onUpdate={...} />` usage and add the two new props:

```tsx
          <Inspector section={sections.find((s) => s.id === selectedId) ?? null} onUpdate={(patch) => apply((s) => updateSection(s, selectedId!, patch))} images={images} onImageResolved={registerImage} />
```

(Match whatever the existing `onUpdate` callback expression is verbatim — do not change it, only add the two new props after it.)

- [ ] **Step 4: Thread `images`/`onImageResolved` through the Inspector**

Edit `src/app/admin/(panel)/homepage/inspector.tsx`. Update the component signature:

```ts
import type { HomepageImageDTO } from "@/lib/data/homepage";

export function Inspector({
  section,
  onUpdate,
  images,
  onImageResolved,
}: {
  section: Section | null;
  onUpdate: (patch: Partial<Section>) => void;
  images: Record<string, HomepageImageDTO>;
  onImageResolved: (id: string, image: HomepageImageDTO) => void;
}) {
```

In the `case "about":` branch, pass the new props through:

```tsx
    case "about":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <AboutForm section={section} onUpdate={onUpdate} images={images} onImageResolved={onImageResolved} />
        </div>
      );
```

- [ ] **Step 5: Wire the picker into `AboutForm`**

Replace the whole body of `src/app/admin/(panel)/homepage/section-forms/about.tsx`:

```tsx
// src/app/admin/(panel)/homepage/section-forms/about.tsx
"use client";

import { ImagePicker } from "@/components/admin/image-picker";
import type { HomepageImageDTO } from "@/lib/data/homepage";
import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AboutForm({
  section,
  onUpdate,
  images,
  onImageResolved,
}: {
  section: SectionOfType<"about">;
  onUpdate: (patch: Partial<Section>) => void;
  images: Record<string, HomepageImageDTO>;
  onImageResolved: (id: string, image: HomepageImageDTO) => void;
}) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  const image = c.imageId ? images[c.imageId] : undefined;
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Heading</span>
        <input value={c.heading ?? ""} onChange={(e) => patchContent({ heading: e.target.value || undefined })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Body (one paragraph per line)</span>
        <textarea value={c.body} onChange={(e) => patchContent({ body: e.target.value })} rows={5} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <div className="grid gap-1">
        <span className="text-sm text-muted">Image</span>
        <ImagePicker
          uploadId={c.imageId}
          url={image?.url ?? null}
          alt={image?.alt ?? ""}
          onChange={(uploadId, url, alt) => {
            onImageResolved(uploadId, { url, alt });
            patchContent({ imageId: uploadId });
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, sign in with `homepage.edit`, open `/admin/homepage`, select the About section, upload an image, confirm the preview appears without a page reload, then reload the page and confirm the image and alt text persisted.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/homepage.ts "src/app/admin/(panel)/homepage/page.tsx" "src/app/admin/(panel)/homepage/homepage-builder.tsx" "src/app/admin/(panel)/homepage/inspector.tsx" "src/app/admin/(panel)/homepage/section-forms/about.tsx"
git commit -m "feat(homepage): wire the image picker into the About section form"
```

---

## Task 14: Wire the Achievements section's per-item image picker

**Files:**
- Modify: `src/app/admin/(panel)/homepage/inspector.tsx`
- Modify: `src/app/admin/(panel)/homepage/section-forms/achievements.tsx`

**Interfaces:**
- Consumes: `images`/`onImageResolved` (Task 13, already flowing into `Inspector`); `ImagePicker` (Task 12).

- [ ] **Step 1: Pass `images`/`onImageResolved` to `AchievementsForm`**

In `src/app/admin/(panel)/homepage/inspector.tsx`, find the `case "achievements":` branch and add the two props (same shape as Task 13 Step 4's `about` branch):

```tsx
    case "achievements":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <AchievementsForm section={section} onUpdate={onUpdate} images={images} onImageResolved={onImageResolved} />
        </div>
      );
```

- [ ] **Step 2: Add a per-item picker to `AchievementsForm`**

Replace the whole file `src/app/admin/(panel)/homepage/section-forms/achievements.tsx`:

```tsx
// src/app/admin/(panel)/homepage/section-forms/achievements.tsx
"use client";

import { ImagePicker } from "@/components/admin/image-picker";
import type { HomepageImageDTO } from "@/lib/data/homepage";
import { newSectionId } from "@/lib/homepage/sections/factories";
import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AchievementsForm({
  section,
  onUpdate,
  images,
  onImageResolved,
}: {
  section: SectionOfType<"achievements">;
  onUpdate: (patch: Partial<Section>) => void;
  images: Record<string, HomepageImageDTO>;
  onImageResolved: (id: string, image: HomepageImageDTO) => void;
}) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      {c.items.map((item, i) => {
        const image = item.imageId ? images[item.imageId] : undefined;
        return (
          <div key={item.id} className="grid grid-cols-[1fr_auto] gap-1.5 rounded-lg border border-line p-2">
            <div className="grid gap-1.5">
              <input value={item.title} onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Title" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
              <input
                type="number"
                value={item.year}
                onChange={(e) => {
                  // Number("") is 0, which fails the schema's min(1990) server-side and wedges the
                  // save-status pill on an error until a valid year is retyped. Leave the item's year
                  // unchanged while the field is transiently empty or not-yet-a-number instead of
                  // pushing an invalid value upstream.
                  const n = Number(e.target.value);
                  if (e.target.value !== "" && Number.isFinite(n)) {
                    patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, year: n } : x)) });
                  }
                }}
                placeholder="Year"
                className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
              />
              <textarea
                value={item.description}
                onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })}
                placeholder="Description"
                rows={2}
                className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
              />
              <input
                value={item.link ?? ""}
                onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, link: e.target.value || undefined } : x)) })}
                placeholder="Link (optional)"
                className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
              />
              <ImagePicker
                uploadId={item.imageId}
                url={image?.url ?? null}
                alt={image?.alt ?? ""}
                onChange={(uploadId, url, alt) => {
                  onImageResolved(uploadId, { url, alt });
                  patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, imageId: uploadId } : x)) });
                }}
              />
            </div>
            <button type="button" onClick={() => patchContent({ items: c.items.filter((_, j) => j !== i) })} className="self-start rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
              ×
            </button>
          </div>
        );
      })}
      {c.items.length < 12 && (
        <button
          type="button"
          onClick={() => patchContent({ items: [...c.items, { id: newSectionId(), title: "New achievement", description: "", year: new Date().getFullYear(), imageId: null }] })}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost"
        >
          + Add achievement
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open the Achievements section, add an item, attach an image via "Choose existing" (using the image uploaded in Task 13's verification), reload and confirm it persisted.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/homepage/inspector.tsx" "src/app/admin/(panel)/homepage/section-forms/achievements.tsx"
git commit -m "feat(homepage): wire the image picker into per-item Achievements images"
```

---

## Task 15: Final verification gate

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors in any file touched by this plan

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Unit tests**

Run: `npx vitest run`
Expected: PASS, including `src/lib/gallery/reorder.test.ts` and `src/lib/gallery/lightbox.test.ts`

- [ ] **Step 4: Integration tests**

Run: `npm run test:int`
Expected: PASS, including `src/server/actions/gallery-albums.int.test.ts` and `src/server/actions/gallery-images.int.test.ts`

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS — confirms `/gallery`, `/gallery/[album]`, `/admin/gallery`, `/admin/gallery/[id]`, `/admin/gallery/new` all compile as real routes and the updated `sitemap.ts` / `homepage.ts` / `about.tsx` / `achievements.tsx` type-check under the production build

- [ ] **Step 6: Manual smoke pass**

With `npm run dev` running and signed in as a super admin: create an album, bulk-upload 3+ photos (confirm the "Add to album" button stays disabled until every photo has alt text), reorder them, set one as cover, add a caption, publish the album, visit `/gallery` and confirm the cover shows, open the album and confirm masonry layout + lightbox keyboard navigation, then toggle GALLERY off in `/admin/pages` and confirm `/gallery` 404s and the sitemap drops it.

- [ ] **Step 7: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(gallery): address final verification findings"
```

(Skip this step if Steps 1–6 all passed with no changes.)

---

## Self-Review

**Spec coverage:**
- §5 data model (`GalleryAlbum`, `GalleryImage`): CRUD in Tasks 2–3, no migration needed (verified against `prisma/schema.prisma:552-581`).
- §6 media pipeline (GALLERY variants, `<Picture>`, blur placeholder): reused as-is — `PURPOSE_RULES.GALLERY` already exists (`src/lib/media/variants.ts:42-46`); bulk upload posts to the existing `/api/admin/uploads` route (Task 7).
- §9 page toggles: `IMPLEMENTED_PAGES` flip + `assertPageEnabled("GALLERY")` in Task 9.
- §10 SEO: `generateMetadata` on both public routes (Tasks 9–10), sitemap entries (Task 9).
- §11 security: every action `requirePermission`-gated and Zod-validated (Tasks 2–3, 12); reorder/caption/cover actions verify ownership (Tasks 2–3); upload route already checks `media.upload` + origin + rate limit.
- §12 accessibility/performance: alt text required at bulk-upload time (Task 7) and in the picker (Task 12); lazy `<Picture>` throughout; keyboard-navigable lightbox with focus return and `motion-reduce:` (Task 11); admin-only libs (dnd-kit) confined to `src/app/admin/**`.
- §14 routes: `/gallery`, `/gallery/[album]`, `/admin/gallery`, `/admin/gallery/[id]` all created (Tasks 5, 6, 9, 10); `/admin/gallery/new` added as the create screen (not separately listed in §14 but follows the same pattern as `/admin/sponsors/new`, which also isn't separately listed).
- §16 quick action "Upload to gallery": Task 5.
- §17 phase 5 gallery scope (albums, bulk upload, ordering, masonry, lightbox): Tasks 2–11.
- Homepage About/Achievements image picker (task addendum): Tasks 12–14, reusing `resolveHomepageImages`/`resolveContentImages` conventions.

**Placeholder scan:** no "TBD"/"handle edge cases"/unshown code — every step has literal code. The one intentionally two-step edit (Task 8 Steps 1–2, `Tile`'s `albumId` placeholder) is corrected within the same task before Task 8's tests/typecheck step, not left dangling into a later task.

**Type consistency:** `reorderIds(ids, fromIndex, toIndex)` (Task 1) is called identically in Task 5 (`AlbumList`) and Task 8 (`ImageGrid`). `wrapIndex(index, length, delta)` (Task 1) is called identically in Task 11 (`Lightbox`). `GalleryImageDTO`/`GalleryAlbumCardDTO`/`GalleryAlbumDetailDTO` (Task 4) are the exact types consumed in Tasks 9–11. `HomepageImageDTO` (Task 13) is the exact type threaded through Tasks 13–14's `Inspector`/`AboutForm`/`AchievementsForm` signatures.

## Files verified against real source (signatures/behavior confirmed by reading, not assumed)

`prisma/schema.prisma` (`GalleryAlbum`/`GalleryImage`/`Upload` models, relation names `upload`/`cover`/`event`/`images`), `src/lib/rbac/permissions.ts` (`gallery.manage` exists), `src/lib/pages/registry.ts`, `src/lib/media/variants.ts` (`PURPOSE_RULES.GALLERY`, no fixed aspect), `src/lib/media/public-image.ts` (`toPublicImage`, `publicImageSelect`, `imageUrl`), `src/components/media/picture.tsx`, `src/server/actions/sponsors.ts` + `.int.test.ts`, `src/server/actions/categories.ts`, `src/server/actions/homepage.ts`, `src/app/admin/(panel)/sponsors/page.tsx`, `sponsor-form.tsx`, `[id]/page.tsx`, `new/page.tsx`, `src/components/admin/image-upload-field.tsx`, `src/app/admin/(panel)/forms/[id]/build/inspector.tsx` (its local `ImagePicker`), `form-builder.tsx`/`page.tsx` (images-prop threading), `src/lib/forms/content-images.ts`, `src/app/api/admin/uploads/route.ts`, `src/lib/auth/api.ts`, `src/lib/security/limiters.ts` (`uploadLimiter`: 60/min), `src/lib/actions.ts`, `src/lib/auth/guard.ts`, `src/lib/audit.ts`, `src/lib/audit-labels.ts`, `src/lib/cache-tags.ts`, `src/lib/data/homepage.ts` (`resolveHomepageImages`, `unstable_cache` usage), `src/lib/data/sponsors.ts`, `src/lib/data/events.ts` (args-based `unstable_cache` pattern), `src/lib/forms-data.ts` (`isChecked`), `src/lib/request-meta.ts`, `src/lib/errors.ts`, `src/lib/utils/slug.ts`, `src/app/sitemap.ts`, `src/app/(site)/sponsors/page.tsx`, `src/app/(site)/events/page.tsx`, `src/components/admin/nav-items.ts`, `src/components/admin/quick-actions.ts`, `src/components/admin/page-header.tsx`, `src/components/admin/confirm-submit.tsx`, `src/components/admin/form-state.tsx`, `src/components/ui/{button,field,select,switch,input,textarea,form-message,label}.tsx`, `src/app/admin/(panel)/homepage/{page,homepage-builder,inspector,section-list}.tsx`, `src/app/admin/(panel)/homepage/section-forms/{about,achievements,gallery-highlights}.tsx`, `src/components/homepage/sections/gallery-highlights.tsx`, `src/lib/homepage/sections/schema.ts` (`aboutContentSchema`, `achievementsContentSchema`, `galleryHighlightsContentSchema`), `src/lib/homepage/sections/ops.ts` (`reorderSections` precedent), `src/server/media/images.ts` (`ensureImages`, `updateImageAlt`), `src/server/media/save-image.ts`, `src/test/session.ts`, `src/test/factories.ts`, `src/test/int-setup.ts` (dynamic `TRUNCATE`, no per-table list needed), `package.json` (dnd-kit/lucide-react/motion versions).
