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
import { isChecked } from "@/lib/forms-data";
import { albumFormSchema, parseAlbumDate } from "@/lib/gallery/schema";
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
      : await uniqueSlug(slugify(input.title) || "album", async (s) => {
          const hit = await db.galleryAlbum.findUnique({ where: { slug: s }, select: { id: true } });
          return Boolean(hit);
        });
    const meta = await getRequestMeta();
    const album = await db.$transaction(async (tx) => {
      const order = existing ? existing.order : ((await tx.galleryAlbum.aggregate({ _max: { order: true } }))._max.order ?? -1) + 1;
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
