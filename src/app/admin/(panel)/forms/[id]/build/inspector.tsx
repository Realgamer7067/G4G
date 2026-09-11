"use client";

import { useRef, useState } from "react";
import { Copy, GripVertical, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field as FieldControl } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ContentImage } from "@/components/forms/form-wizard";
import { CHOICE_TYPES, FILE_KINDS, type Block, type Field, type FieldType, type Option } from "@/lib/forms/engine/schema";
import { updateContentImageAltAction } from "@/server/actions/forms";
import { cn } from "@/lib/utils/cn";
import { ConditionGroupEditor } from "./condition-editor";

const TEXT_LIKE: readonly FieldType[] = ["short_text", "long_text", "email", "phone", "url"];

const FILE_KIND_LABELS: Record<(typeof FILE_KINDS)[number], string> = { pdf: "PDF", image: "Image", doc: "Word doc", slides: "Slides", zip: "ZIP" };

function num(v: string): number | undefined {
  return v === "" ? undefined : Number(v);
}

/** Uploads a content-block image straight to the media pipeline (no crop — content images can be any shape). */
function ImagePicker({ uploadId, url, alt, onChange }: { uploadId: string | undefined; url: string | null; alt: string; onChange: (uploadId: string, url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [altValue, setAltValue] = useState(alt);
  const [altSaved, setAltSaved] = useState(true);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("purpose", "GENERIC");
    body.set("alt", altValue);
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; error?: string };
      if (!res.ok || !json.id || !json.url) throw new Error(json.error ?? "Upload failed. Try again.");
      onChange(json.id, json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function saveAlt() {
    if (!uploadId || altSaved) return;
    const result = await updateContentImageAltAction(uploadId, altValue);
    if (result.ok) setAltSaved(true);
  }

  return (
    <div className="grid gap-2">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- builder preview of the resolved public variant
        <img src={url} alt="" className={cn("aspect-video w-full rounded-lg border border-line bg-night object-cover")} />
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />
      <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => input.current?.click()} className="justify-self-start">
        {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
        {uploadId ? "Replace image" : "Choose image"}
      </Button>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {uploadId && (
        <FieldControl label="Alt text" htmlFor="c-image-alt" hint="Describes the image for screen readers.">
          <Input
            id="c-image-alt"
            value={altValue}
            onChange={(e) => {
              setAltValue(e.target.value);
              setAltSaved(false);
            }}
            onBlur={() => void saveAlt()}
            maxLength={300}
          />
        </FieldControl>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-line pt-4 first:border-0 first:pt-0">
      <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{title}</h3>
      {children}
    </section>
  );
}

function OptionsEditor({
  field,
  earlier,
  onAdd,
  onUpdate,
  onRemove,
  onDuplicate,
  onMove,
}: {
  field: Field;
  earlier: Field[];
  onAdd: () => void;
  onUpdate: (optionId: string, patch: Partial<Option>) => void;
  onRemove: (optionId: string) => void;
  onDuplicate: (optionId: string) => void;
  onMove: (optionId: string, dir: -1 | 1) => void;
}) {
  const [openRule, setOpenRule] = useState<string | null>(null);
  const options = field.options ?? [];
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {options.map((o, i) => (
          <li key={o.id} className="grid gap-2 rounded-lg border border-line bg-night/40 p-2">
            <div className="flex items-center gap-1.5">
              <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted/50" />
              <Input aria-label={`Option ${i + 1}`} value={o.label} onChange={(e) => onUpdate(o.id, { label: e.target.value })} className="h-9" />
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => onMove(o.id, -1)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
                  ↑
                </button>
                <button type="button" aria-label="Move down" disabled={i === options.length - 1} onClick={() => onMove(o.id, 1)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
                  ↓
                </button>
                <button type="button" aria-label="Duplicate option" onClick={() => onDuplicate(o.id)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost">
                  <Copy className="size-3.5" aria-hidden="true" />
                </button>
                <button type="button" aria-label="Remove option" disabled={options.length <= 1} onClick={() => onRemove(o.id)} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger disabled:opacity-30">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
            {earlier.length > 0 && (
              <div>
                <button type="button" onClick={() => setOpenRule(openRule === o.id ? null : o.id)} className="text-xs text-leaf hover:underline">
                  {o.visibleWhen ? "Edit visibility rule" : "+ Only show this option when…"}
                </button>
                {openRule === o.id && (
                  <div className="mt-2 rounded-lg border border-line bg-surface p-2.5">
                    <ConditionGroupEditor group={o.visibleWhen} onChange={(g) => onUpdate(o.id, { visibleWhen: g })} fields={earlier} emptyLabel="Always an available choice" addLabel="Add a condition" />
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={onAdd}>
        <Plus className="size-4" aria-hidden="true" /> Add option
      </Button>
    </div>
  );
}

export function Inspector({
  block,
  earlier,
  images,
  onUpdateBlock,
  onRemoveBlock,
  onDuplicateBlock,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onDuplicateOption,
  onMoveOption,
}: {
  block: Block | null;
  earlier: Field[];
  images: Record<string, ContentImage>;
  onUpdateBlock: (patch: Partial<Block>) => void;
  onRemoveBlock: () => void;
  onDuplicateBlock: () => void;
  onAddOption: () => void;
  onUpdateOption: (optionId: string, patch: Partial<Option>) => void;
  onRemoveOption: (optionId: string) => void;
  onDuplicateOption: (optionId: string) => void;
  onMoveOption: (optionId: string, dir: -1 | 1) => void;
}) {
  if (!block) {
    return (
      <aside className="grid content-start gap-2 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        <p>Select a question or content block to edit its settings.</p>
      </aside>
    );
  }

  const v = block.kind === "field" ? (block.validation ?? {}) : {};
  const patchValidation = (patch: Partial<Field["validation"]>) => onUpdateBlock({ validation: { ...v, ...patch } } as Partial<Block>);

  return (
    <aside className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">{block.kind === "field" ? "Question settings" : "Content block"}</h2>
        <div className="flex gap-1">
          <button type="button" aria-label="Duplicate" onClick={onDuplicateBlock} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-frost">
            <Copy className="size-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Delete" onClick={onRemoveBlock} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {block.kind === "content" ? (
        <>
          {block.type !== "divider" && block.type !== "image" && (
            <FieldControl label="Text" htmlFor="c-text">
              <Textarea id="c-text" rows={3} value={block.text ?? ""} onChange={(e) => onUpdateBlock({ text: e.target.value })} maxLength={2000} />
            </FieldControl>
          )}
          {block.type === "callout" && (
            <FieldControl label="Tone" htmlFor="c-tone">
              <Select id="c-tone" value={block.tone ?? "info"} onChange={(e) => onUpdateBlock({ tone: e.target.value as "info" | "warning" })}>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
              </Select>
            </FieldControl>
          )}
          {block.type === "image" && (
            <FieldControl label="Image" htmlFor="c-image">
              <ImagePicker
                uploadId={block.uploadId}
                url={images[block.uploadId ?? ""]?.url ?? null}
                alt={images[block.uploadId ?? ""]?.alt ?? ""}
                onChange={(id) => onUpdateBlock({ uploadId: id })}
              />
            </FieldControl>
          )}
        </>
      ) : (
        <>
          <Section title="Question">
            <FieldControl label="Label" htmlFor="f-label">
              <Input id="f-label" value={block.label} onChange={(e) => onUpdateBlock({ label: e.target.value })} maxLength={300} />
            </FieldControl>
            <FieldControl label="Help text" htmlFor="f-help" hint="Optional, shown under the question.">
              <Input id="f-help" value={block.help ?? ""} onChange={(e) => onUpdateBlock({ help: e.target.value })} maxLength={500} />
            </FieldControl>
            {TEXT_LIKE.includes(block.type) && (
              <FieldControl label="Placeholder" htmlFor="f-placeholder">
                <Input id="f-placeholder" value={block.placeholder ?? ""} onChange={(e) => onUpdateBlock({ placeholder: e.target.value })} maxLength={200} />
              </FieldControl>
            )}
            <div className="flex items-center justify-between">
              <Switch label="Required" checked={block.required} onChange={(e) => onUpdateBlock({ required: e.target.checked })} />
              <Select aria-label="Width" value={block.width ?? "full"} onChange={(e) => onUpdateBlock({ width: e.target.value as "full" | "half" })} className="h-9 w-32">
                <option value="full">Full width</option>
                <option value="half">Half width</option>
              </Select>
            </div>
          </Section>

          {CHOICE_TYPES.has(block.type) && (
            <Section title="Options">
              <OptionsEditor field={block} earlier={earlier} onAdd={onAddOption} onUpdate={onUpdateOption} onRemove={onRemoveOption} onDuplicate={onDuplicateOption} onMove={onMoveOption} />
              {block.type === "checkboxes" && (
                <div className="grid grid-cols-2 gap-2">
                  <FieldControl label="Min selections" htmlFor="f-minsel">
                    <Input id="f-minsel" type="number" min={0} max={100} value={v.minSelections ?? ""} onChange={(e) => patchValidation({ minSelections: num(e.target.value) })} />
                  </FieldControl>
                  <FieldControl label="Max selections" htmlFor="f-maxsel">
                    <Input id="f-maxsel" type="number" min={1} max={100} value={v.maxSelections ?? ""} onChange={(e) => patchValidation({ maxSelections: num(e.target.value) })} />
                  </FieldControl>
                </div>
              )}
            </Section>
          )}

          {(block.type === "short_text" || block.type === "long_text") && (
            <Section title="Length">
              <div className="grid grid-cols-2 gap-2">
                <FieldControl label="Min characters" htmlFor="f-minlen">
                  <Input id="f-minlen" type="number" min={0} max={10000} value={v.minLength ?? ""} onChange={(e) => patchValidation({ minLength: num(e.target.value) })} />
                </FieldControl>
                <FieldControl label="Max characters" htmlFor="f-maxlen">
                  <Input id="f-maxlen" type="number" min={1} max={10000} value={v.maxLength ?? ""} onChange={(e) => patchValidation({ maxLength: num(e.target.value) })} />
                </FieldControl>
              </div>
            </Section>
          )}

          {block.type === "number" && (
            <Section title="Range">
              <div className="grid grid-cols-2 gap-2">
                <FieldControl label="Minimum" htmlFor="f-min">
                  <Input id="f-min" type="number" value={v.min ?? ""} onChange={(e) => patchValidation({ min: num(e.target.value) })} />
                </FieldControl>
                <FieldControl label="Maximum" htmlFor="f-max">
                  <Input id="f-max" type="number" value={v.max ?? ""} onChange={(e) => patchValidation({ max: num(e.target.value) })} />
                </FieldControl>
              </div>
            </Section>
          )}

          {block.type === "linear_scale" && (
            <Section title="Scale">
              <div className="grid grid-cols-2 gap-2">
                <FieldControl label="From" htmlFor="f-scalemin">
                  <Input id="f-scalemin" type="number" min={0} max={10} value={v.scaleMin ?? 1} onChange={(e) => patchValidation({ scaleMin: num(e.target.value) })} />
                </FieldControl>
                <FieldControl label="To" htmlFor="f-scalemax">
                  <Input id="f-scalemax" type="number" min={1} max={10} value={v.scaleMax ?? 5} onChange={(e) => patchValidation({ scaleMax: num(e.target.value) })} />
                </FieldControl>
                <FieldControl label="Label for lowest" htmlFor="f-scaleminlabel">
                  <Input id="f-scaleminlabel" value={v.scaleMinLabel ?? ""} onChange={(e) => patchValidation({ scaleMinLabel: e.target.value })} maxLength={40} />
                </FieldControl>
                <FieldControl label="Label for highest" htmlFor="f-scalemaxlabel">
                  <Input id="f-scalemaxlabel" value={v.scaleMaxLabel ?? ""} onChange={(e) => patchValidation({ scaleMaxLabel: e.target.value })} maxLength={40} />
                </FieldControl>
              </div>
            </Section>
          )}

          {block.type === "rating" && (
            <Section title="Rating">
              <FieldControl label="Out of" htmlFor="f-ratingmax">
                <Input id="f-ratingmax" type="number" min={2} max={10} value={v.max ?? 5} onChange={(e) => patchValidation({ max: num(e.target.value) })} />
              </FieldControl>
            </Section>
          )}

          {block.type === "file" && (
            <Section title="File uploads">
              <div className="flex flex-wrap gap-1.5">
                {FILE_KINDS.map((k) => {
                  const checked = (v.fileTypes ?? []).includes(k);
                  return (
                    <label key={k} className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-xs", checked ? "border-leaf bg-leaf/15 text-leaf" : "border-line text-muted")}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={(e) => {
                          const set = new Set(v.fileTypes ?? []);
                          if (e.target.checked) set.add(k);
                          else set.delete(k);
                          patchValidation({ fileTypes: [...set] });
                        }}
                      />
                      {FILE_KIND_LABELS[k]}
                    </label>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldControl label="Max size (MB)" htmlFor="f-maxmb">
                  <Input id="f-maxmb" type="number" min={1} max={10} value={v.maxFileMb ?? 5} onChange={(e) => patchValidation({ maxFileMb: num(e.target.value) })} />
                </FieldControl>
                <FieldControl label="Max files" htmlFor="f-maxfiles">
                  <Input id="f-maxfiles" type="number" min={1} max={5} value={v.maxFiles ?? 1} onChange={(e) => patchValidation({ maxFiles: num(e.target.value) })} />
                </FieldControl>
              </div>
            </Section>
          )}
        </>
      )}

      <Section title={block.kind === "field" ? "Only show this question when…" : "Only show this block when…"}>
        <ConditionGroupEditor group={block.visibleWhen} onChange={(g) => onUpdateBlock({ visibleWhen: g })} fields={earlier} />
      </Section>
    </aside>
  );
}
