"use client";

import { useRef, useState } from "react";
import { Check, FileUp, Loader2, Star, X } from "lucide-react";
import type { AnswerValue, Field } from "@/lib/forms/engine/schema";
import { cn } from "@/lib/utils/cn";

export type UploadedFile = { id: string; name: string; size: number };

const inputBase =
  "w-full rounded-xl border border-line bg-night/70 px-3.5 text-[15px] text-frost placeholder:text-muted/50 transition-colors focus-visible:border-leaf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/30 aria-[invalid=true]:border-danger";

const INPUT_TYPES: Partial<Record<Field["type"], string>> = {
  short_text: "text",
  email: "email",
  phone: "tel",
  url: "url",
  number: "number",
  date: "date",
  time: "time",
};

const AUTOCOMPLETE: Partial<Record<Field["type"], string>> = { email: "email", phone: "tel", url: "url" };

function formatSize(bytes: number) {
  return bytes > 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function ChoiceCard({ checked, children, type, name, value, onChange, disabled }: { checked: boolean; children: React.ReactNode; type: "radio" | "checkbox"; name: string; value: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-night/50 px-3.5 py-3 text-[15px] transition-colors hover:border-leaf/40",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-mint",
        checked && "border-leaf/60 bg-leaf/10",
      )}
    >
      <input type={type} name={name} value={value} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "grid size-5 shrink-0 place-items-center border transition-colors",
          type === "radio" ? "rounded-full" : "rounded-md",
          checked ? "border-leaf bg-leaf text-night" : "border-muted/60",
        )}
      >
        {checked && (type === "radio" ? <span className="size-2 rounded-full bg-night" /> : <Check className="size-3.5" strokeWidth={3} />)}
      </span>
      <span>{children}</span>
    </label>
  );
}

function FileInput({ field, value, onChange, slug, uploads, onUploaded, describedBy, preview = false }: { field: Field; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; slug: string; uploads: Record<string, UploadedFile>; onUploaded: (f: UploadedFile) => void; describedBy: string; preview?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = Array.isArray(value) ? value : [];
  const max = field.validation?.maxFiles ?? 1;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("fieldId", field.id);
    try {
      const res = await fetch(`/api/forms/${slug}/upload`, { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as Partial<UploadedFile> & { error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Upload failed. Try again.");
      onUploaded({ id: json.id, name: json.name ?? file.name, size: json.size ?? file.size });
      onChange([...ids, json.id]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      {ids.map((id) => (
        <div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-night/50 px-3.5 py-2.5 text-sm">
          <span className="min-w-0 truncate">{uploads[id]?.name ?? "Uploaded file"}</span>
          <span className="flex items-center gap-2 text-xs text-muted">
            {uploads[id] && formatSize(uploads[id].size)}
            <button type="button" aria-label="Remove file" onClick={() => onChange(ids.filter((x) => x !== id))} className="rounded-md p-1 hover:bg-raised hover:text-danger">
              <X className="size-4" aria-hidden="true" />
            </button>
          </span>
        </div>
      ))}
      {ids.length < max && (
        <>
          <input ref={input} type="file" className="sr-only" aria-describedby={describedBy} disabled={preview} onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }} />
          <button
            type="button"
            disabled={busy || preview}
            onClick={() => input.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-night/40 px-4 py-5 text-sm text-muted transition-colors hover:border-leaf/50 hover:text-frost disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />}
            {busy ? "Uploading…" : `Choose a file${field.validation?.maxFileMb ? ` (up to ${field.validation.maxFileMb} MB)` : ""}`}
          </button>
        </>
      )}
      {preview && <p className="text-xs italic text-muted">File uploads aren&apos;t available in preview.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
  error,
  visibleOptions,
  slug,
  uploads,
  onUploaded,
  preview = false,
}: {
  field: Field;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  error?: string;
  visibleOptions?: Set<string>;
  slug: string;
  uploads: Record<string, UploadedFile>;
  onUploaded: (f: UploadedFile) => void;
  preview?: boolean;
}) {
  const id = `q-${field.id}`;
  const describedBy = [field.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": field.required || undefined } as const;
  const options = (field.options ?? []).filter((o) => !visibleOptions || visibleOptions.has(o.id));
  const text = typeof value === "string" || typeof value === "number" ? String(value) : "";
  const isGroup = ["radio", "checkboxes", "linear_scale", "rating", "yes_no"].includes(field.type);

  let control: React.ReactNode;
  switch (field.type) {
    case "long_text":
      control = <textarea {...common} rows={4} value={text} placeholder={field.placeholder} maxLength={field.validation?.maxLength ?? 5000} onChange={(e) => onChange(e.target.value)} className={cn(inputBase, "py-3")} />;
      break;
    case "dropdown":
      control = (
        <select {...common} value={text} onChange={(e) => onChange(e.target.value)} className={cn(inputBase, "h-12 appearance-none")}>
          <option value="">{field.placeholder || "Choose…"}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case "radio":
      control = (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <ChoiceCard key={o.id} type="radio" name={id} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)}>
              {o.label}
            </ChoiceCard>
          ))}
        </div>
      );
      break;
    case "checkboxes": {
      const list = Array.isArray(value) ? value : [];
      control = (
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <ChoiceCard key={o.id} type="checkbox" name={id} value={o.id} checked={list.includes(o.id)} onChange={(on) => onChange(on ? [...list, o.id] : list.filter((x) => x !== o.id))}>
              {o.label}
            </ChoiceCard>
          ))}
        </div>
      );
      break;
    }
    case "yes_no":
      control = (
        <div className="grid max-w-sm grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((v) => (
            <ChoiceCard key={v} type="radio" name={id} value={v} checked={value === v} onChange={() => onChange(v)}>
              {v === "yes" ? "Yes" : "No"}
            </ChoiceCard>
          ))}
        </div>
      );
      break;
    case "linear_scale": {
      const lo = field.validation?.scaleMin ?? 1;
      const hi = field.validation?.scaleMax ?? 5;
      control = (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((n) => (
              <label key={n} className={cn("grid size-11 cursor-pointer place-items-center rounded-xl border border-line bg-night/50 font-mono text-sm transition-colors hover:border-leaf/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint", Number(value) === n && "border-leaf bg-leaf font-semibold text-night")}>
                <input type="radio" name={id} value={n} checked={Number(value) === n} onChange={() => onChange(n)} className="sr-only" />
                {n}
              </label>
            ))}
          </div>
          {(field.validation?.scaleMinLabel || field.validation?.scaleMaxLabel) && (
            <div className="flex justify-between text-xs text-muted" aria-hidden="true">
              <span>{field.validation?.scaleMinLabel}</span>
              <span>{field.validation?.scaleMaxLabel}</span>
            </div>
          )}
        </div>
      );
      break;
    }
    case "rating": {
      const hi = field.validation?.max ?? 5;
      control = (
        <div className="flex gap-1">
          {Array.from({ length: hi }, (_, i) => i + 1).map((n) => (
            <label key={n} className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint">
              <input type="radio" name={id} value={n} checked={Number(value) === n} onChange={() => onChange(n)} className="sr-only" aria-label={`${n} out of ${hi}`} />
              <Star aria-hidden="true" className={cn("size-8 transition-colors", Number(value) >= n ? "fill-amber text-amber" : "text-muted/50")} />
            </label>
          ))}
        </div>
      );
      break;
    }
    case "file":
      control = <FileInput field={field} value={value} onChange={onChange} slug={slug} uploads={uploads} onUploaded={onUploaded} describedBy={describedBy ?? ""} preview={preview} />;
      break;
    default:
      control = (
        <input
          {...common}
          type={INPUT_TYPES[field.type] ?? "text"}
          value={text}
          placeholder={field.placeholder}
          autoComplete={AUTOCOMPLETE[field.type]}
          inputMode={field.type === "number" ? "decimal" : undefined}
          maxLength={field.type === "short_text" ? (field.validation?.maxLength ?? 500) : undefined}
          min={field.type === "number" ? field.validation?.min : undefined}
          max={field.type === "number" ? field.validation?.max : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputBase, "h-12")}
        />
      );
  }

  const label = (
    <>
      {field.label}
      {field.required && (
        <span className="ml-1 text-leaf" aria-hidden="true">
          *
        </span>
      )}
    </>
  );

  return (
    <div className={cn("grid content-start gap-2", field.width === "half" ? "sm:col-span-1" : "sm:col-span-2")}>
      {isGroup ? (
        <fieldset className="grid gap-2" aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
          <legend className="mb-2 text-[15px] font-medium">{label}</legend>
          {field.help && <p id={`${id}-help`} className="-mt-2 text-sm text-muted">{field.help}</p>}
          {control}
        </fieldset>
      ) : (
        <>
          <label htmlFor={id} className="text-[15px] font-medium">
            {label}
          </label>
          {field.help && <p id={`${id}-help`} className="-mt-1 text-sm text-muted">{field.help}</p>}
          {control}
        </>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
