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
    const id = /REDIRECT:\/admin\/gallery\/([^?]+)\?created=1/.exec(String((created as Error).message))?.[1] as string;
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
  it("appends a new album after the highest order even after a delete", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const a = await db.galleryAlbum.create({ data: { title: "A", slug: "a", order: 0 } });
    await db.galleryAlbum.create({ data: { title: "B", slug: "b", order: 1 } });
    await db.galleryAlbum.create({ data: { title: "C", slug: "c", order: 2 } });
    await db.galleryAlbum.delete({ where: { id: a.id } });
    await saveAlbumAction(undefined, formOf({ title: "New" })).catch(() => {});
    const rows = await db.galleryAlbum.findMany({ orderBy: { order: "asc" } });
    expect(new Set(rows.map((r) => r.order)).size).toBe(3);
    expect(rows[rows.length - 1].title).toBe("New");
  });
});
