import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { addGalleryImagesAction, updateGalleryImageAction, reorderGalleryImagesAction, deleteGalleryImageAction } = await import("./gallery-images");

async function createAlbum() {
  return db.galleryAlbum.create({ data: { title: "Test Album", slug: `test-album-${Math.random().toString(36).slice(2, 8)}` } });
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
  it("appends after the highest order even after a delete", async () => {
    await signIn({ permissions: ["gallery.manage"] });
    const album = await createAlbum();
    const ups = await Promise.all(["g1", "g2", "g3", "g4"].map(createUpload));
    const first = await db.galleryImage.create({ data: { albumId: album.id, uploadId: ups[0].id, order: 0 } });
    await db.galleryImage.create({ data: { albumId: album.id, uploadId: ups[1].id, order: 1 } });
    await db.galleryImage.create({ data: { albumId: album.id, uploadId: ups[2].id, order: 2 } });
    await db.galleryImage.delete({ where: { id: first.id } });
    expect(await addGalleryImagesAction(album.id, [{ uploadId: ups[3].id, alt: "Late" }])).toEqual({ ok: true, data: { added: 1 } });
    const orders = (await db.galleryImage.findMany({ where: { albumId: album.id }, orderBy: { order: "asc" } })).map((i) => i.order);
    expect(new Set(orders).size).toBe(3);
    expect(orders[2]).toBe(3);
  });
});
