"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteGalleryImageAction, reorderGalleryImagesAction, updateGalleryImageAction } from "@/server/actions/gallery-images";
import { setAlbumCoverAction } from "@/server/actions/gallery-albums";
import { reorderIds } from "@/lib/gallery/reorder";
import { cn } from "@/lib/utils/cn";

export type GridImage = { id: string; uploadId: string; url: string; alt: string; caption: string };

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  const [caption, setCaption] = useState(image.caption);
  const [saved, setSaved] = useState(true);
  const [confirming, setConfirming] = useState(false);

  async function saveCaption() {
    if (saved) return;
    const result = await updateGalleryImageAction(albumId, image.id, caption);
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
                albumId={albumId}
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
