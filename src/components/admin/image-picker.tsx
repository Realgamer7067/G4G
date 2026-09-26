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
        tabIndex={-1}
        aria-hidden="true"
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
