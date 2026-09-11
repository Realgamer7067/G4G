"use client";

import { useCallback, useId, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PURPOSE_RULES, type ImagePurpose } from "@/lib/media/variants";
import { cn } from "@/lib/utils/cn";

export type UploadedImage = { id: string; url: string; alt: string };

const PREVIEW_SHAPE: Record<ImagePurpose, string> = {
  POSTER: "aspect-video",
  COVER: "aspect-video",
  GALLERY: "aspect-[4/3]",
  TEAM: "aspect-square max-w-48",
  AVATAR: "aspect-square max-w-32",
  LOGO: "aspect-[2/1] max-w-72",
  SPONSOR: "aspect-[2/1] max-w-72",
  GENERIC: "aspect-video",
};

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * Picks an image, crops it when the purpose has a fixed shape, uploads it, and exposes the upload id
 * through a hidden input named `name`. Alt text is submitted as `${name}Alt`.
 */
export function ImageUploadField({
  name,
  purpose,
  label,
  initial = null,
  description,
}: {
  name: string;
  purpose: ImagePurpose;
  label: string;
  initial?: UploadedImage | null;
  description?: string;
}) {
  const rule = PURPOSE_RULES[purpose];
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const altInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const [image, setImage] = useState<UploadedImage | null>(initial);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  function closeCropper() {
    dialog.current?.close();
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  }

  async function upload(file: File, cropArea: Area | null) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", purpose);
    body.set("alt", altInput.current?.value ?? image?.alt ?? "");
    if (cropArea) body.set("crop", JSON.stringify(cropArea));
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; alt?: string; error?: string };
      if (!res.ok || !json.id || !json.url) throw new Error(json.error ?? "Upload failed. Try again.");
      setImage({ id: json.id, url: json.url, alt: json.alt ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function onFileChosen(file: File | undefined) {
    if (fileInput.current) fileInput.current.value = "";
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Choose a JPG, PNG, WebP or AVIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Images must be 15 MB or smaller.");
      return;
    }
    if (!rule.aspect) {
      void upload(file, null);
      return;
    }
    setPending({ file, url: URL.createObjectURL(file) });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    dialog.current?.showModal();
  }

  async function confirmCrop() {
    if (!pending) return;
    const file = pending.file;
    const cropArea = area;
    closeCropper();
    await upload(file, cropArea);
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="grid gap-3">
      <div className="grid gap-1">
        <span id={`${id}-label`} className="text-[13px] font-medium text-frost">
          {label}
        </span>
        <p className="text-xs text-muted">
          {description ?? rule.recommended} JPG, PNG, WebP or AVIF, up to 15 MB.
        </p>
      </div>

      <div
        className={cn(
          "relative grid w-full place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-night",
          PREVIEW_SHAPE[purpose],
          (purpose === "LOGO" || purpose === "SPONSOR") && image && "border-solid bg-tile",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of a just-uploaded variant
          <img
            src={image.url}
            alt=""
            className={cn("size-full", purpose === "LOGO" || purpose === "SPONSOR" ? "object-contain p-3" : "object-cover")}
          />
        ) : (
          <span className="grid justify-items-center gap-1 p-4 text-center text-xs text-muted">
            <ImagePlus aria-hidden="true" className="size-5" />
            No image yet
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 grid place-items-center bg-night/70" role="status">
            <Loader2 aria-hidden="true" className="size-6 animate-spin text-leaf" />
            <span className="sr-only">Uploading…</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          id={`${id}-file`}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => onFileChosen(e.target.files?.[0])}
        />
        <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <ImagePlus aria-hidden="true" className="size-4" />
          {image ? "Replace image" : "Choose image"}
        </Button>
        {image && (
          <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => setImage(null)}>
            <Trash2 aria-hidden="true" className="size-4" />
            Remove
          </Button>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-alt`}>Alt text</Label>
        <Input
          ref={altInput}
          id={`${id}-alt`}
          name={`${name}Alt`}
          defaultValue={image?.alt ?? ""}
          key={image?.id ?? "none"}
          maxLength={300}
          required={!!image}
          placeholder="Describe the image for people using screen readers"
        />
      </div>

      <input type="hidden" name={name} value={image?.id ?? ""} />
      <FormMessage>{error}</FormMessage>

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-crop-title`}
        onCancel={(e) => {
          e.preventDefault();
          closeCropper();
        }}
        className="m-auto w-[min(720px,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-frost backdrop:bg-night/80"
      >
        <div className="grid gap-4 p-5">
          <div className="grid gap-1">
            <h2 id={`${id}-crop-title`} className="font-display text-lg font-semibold">
              Crop to {rule.aspectLabel}
            </h2>
            <p className="text-xs text-muted">Drag to position, use the slider to zoom.</p>
          </div>
          <div className={cn("relative w-full overflow-hidden rounded-xl bg-night", rule.aspect === 1 ? "aspect-square max-h-[60vh]" : "aspect-video")}>
            {pending && (
              <Cropper
                image={pending.url}
                crop={crop}
                zoom={zoom}
                aspect={rule.aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
              />
            )}
          </div>
          <label className="grid gap-1.5 text-[13px]" htmlFor={`${id}-zoom`}>
            Zoom
            <input
              id={`${id}-zoom`}
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="accent-leaf"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeCropper}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmCrop} disabled={!area}>
              Crop and upload
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
