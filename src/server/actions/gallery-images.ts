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
      const start = ((await tx.galleryImage.aggregate({ where: { albumId }, _max: { order: true } }))._max.order ?? -1) + 1;
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
