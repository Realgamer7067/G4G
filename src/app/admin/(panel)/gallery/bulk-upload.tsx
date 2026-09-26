"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { addGalleryImagesAction } from "@/server/actions/gallery-images";

type FileItem = {
  key: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "needs-alt" | "error";
  progress: number;
  uploadId: string | null;
  alt: string;
  error: string | null;
};

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 15 * 1024 * 1024;
const CONCURRENCY = 3;

function uploadOne(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/uploads");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let json: { id?: string; error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        // Malformed body: handled by the status check below.
      }
      if (xhr.status >= 200 && xhr.status < 300 && json.id) resolve(json.id);
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
  const router = useRouter();
  const [items, setItems] = useState<FileItem[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<FileItem[]>([]);
  const active = useRef(0);

  const patch = (key: string, change: Partial<FileItem>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...change } : i)));

  function pump() {
    while (active.current < CONCURRENCY && pending.current.length > 0) {
      const item = pending.current.shift()!;
      active.current += 1;
      patch(item.key, { status: "uploading", progress: 0, error: null });
      uploadOne(item.file, (progress) => patch(item.key, { progress }))
        .then((uploadId) => patch(item.key, { status: "needs-alt", uploadId, progress: 100 }))
        .catch((e: Error) => patch(item.key, { status: "error", error: e.message }))
        .finally(() => {
          active.current -= 1;
          pump();
        });
    }
  }

  function onFilesChosen(files: FileList | null) {
    if (input.current) input.current.value = "";
    if (!files) return;
    const next: FileItem[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPT.includes(file.type) || file.size > MAX_BYTES) {
        skipped.push(file.name);
        continue;
      }
      next.push({ key: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), status: "queued", progress: 0, uploadId: null, alt: "", error: null });
    }
    setRejected(skipped);
    setItems((prev) => [...prev, ...next]);
    pending.current.push(...next);
    pump();
  }

  function removeItem(item: FileItem) {
    pending.current = pending.current.filter((i) => i.key !== item.key);
    URL.revokeObjectURL(item.previewUrl);
    setItems((prev) => prev.filter((i) => i.key !== item.key));
  }

  function retryItem(item: FileItem) {
    patch(item.key, { status: "queued", error: null });
    pending.current.push(item);
    pump();
  }

  const ready = items.filter((i) => i.status === "needs-alt" && i.uploadId);
  const busy = items.some((i) => i.status === "uploading" || i.status === "queued");
  const canAdd = ready.length > 0 && ready.every((i) => i.alt.trim().length > 0) && !busy;

  async function addToAlbum() {
    setAdding(true);
    setAddError(null);
    const result = await addGalleryImagesAction(
      albumId,
      ready.map((i) => ({ uploadId: i.uploadId as string, alt: i.alt.trim() })),
    );
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    for (const r of ready) URL.revokeObjectURL(r.previewUrl);
    setItems((prev) => prev.filter((i) => !ready.some((r) => r.key === i.key)));
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <input ref={input} type="file" accept={ACCEPT.join(",")} multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFilesChosen(e.target.files)} />
      <Button type="button" variant="secondary" onClick={() => input.current?.click()} className="justify-self-start">
        <ImagePlus className="size-4" aria-hidden="true" /> Choose photos
      </Button>
      <p className="text-xs text-muted">JPG, PNG, WebP or AVIF, up to 15 MB each. Every photo needs alt text before it&apos;s added.</p>
      {rejected.length > 0 && (
        <p role="alert" className="text-xs text-danger">
          Skipped (wrong type or over 15 MB): {rejected.join(", ")}
        </p>
      )}

      {items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.key} className="grid min-w-0 gap-2 rounded-xl border border-line bg-night p-3">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview before upload completes */}
                <img src={item.previewUrl} alt="" className="size-full object-cover" />
                {(item.status === "uploading" || item.status === "queued") && (
                  <span className="absolute inset-0 grid place-items-center bg-night/70">
                    <Loader2 aria-hidden="true" className="size-6 animate-spin text-leaf motion-reduce:animate-none" />
                  </span>
                )}
              </div>
              {(item.status === "uploading" || item.status === "queued") && (
                <div className="h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Uploading ${item.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
                  <div className="h-full bg-leaf transition-[width] motion-reduce:transition-none" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-muted">{item.file.name}</span>
                <button type="button" onClick={() => removeItem(item)} aria-label={`Remove ${item.file.name}`} className="shrink-0 rounded p-1 text-muted hover:text-danger">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              {item.status === "error" && (
                <div className="flex items-center gap-2 text-xs text-danger">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{item.error}</span>
                  <button type="button" onClick={() => retryItem(item)} className="underline">
                    Retry
                  </button>
                </div>
              )}
              {item.status === "needs-alt" && (
                <Input
                  value={item.alt}
                  onChange={(e) => patch(item.key, { alt: e.target.value })}
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
            {adding && <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}
            Add {ready.length || ""} photo{ready.length === 1 ? "" : "s"} to album
          </Button>
          {addError && (
            <p role="alert" className="text-sm text-danger">
              {addError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
