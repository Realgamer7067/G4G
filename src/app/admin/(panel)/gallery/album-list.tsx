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

function Row({ album }: { album: GalleryAlbumCardDTO & { isPublished: boolean } }) {
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
