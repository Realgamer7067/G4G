"use client";

import Link from "next/link";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Panel } from "@/components/admin/page-header";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteAlbumAction, saveAlbumAction } from "@/server/actions/gallery-albums";

export type AlbumValues = {
  id: string | null;
  title: string;
  description: string;
  date: string;
  eventId: string | null;
  isPublished: boolean;
};

export function AlbumForm({ values, events }: { values: AlbumValues; events: { id: string; title: string }[] }) {
  const { state, pending, onSubmit } = useFormAction(saveAlbumAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" error={err("title")} className="sm:col-span-2">
            <Input id="title" name="title" defaultValue={values.title} maxLength={100} required {...describedBy("title", err("title"))} />
          </Field>
          <Field label="Date" htmlFor="date" error={err("date")} hint="Optional — shown on the album card.">
            <Input id="date" name="date" type="date" defaultValue={values.date} />
          </Field>
          <Field label="Linked event" htmlFor="eventId" error={err("eventId")} hint="Optional — lets visitors jump between the event and its photos.">
            <Select id="eventId" name="eventId" defaultValue={values.eventId ?? ""}>
              <option value="">No linked event</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="description" error={err("description")} className="sm:col-span-2">
            <Textarea id="description" name="description" rows={3} defaultValue={values.description} maxLength={500} />
          </Field>
        </div>
        <Switch name="isPublished" label="Published (visible on the public gallery)" defaultChecked={values.isPublished} />
      </Panel>
      <SaveBar state={state} pending={pending} label={values.id ? "Save album" : "Create album"} />
    </form>
  );
}

export function DeleteAlbumForm({ id, imageCount }: { id: string; imageCount: number }) {
  const { state, pending, onSubmit } = useFormAction(deleteAlbumAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit label="Delete album" confirmLabel={imageCount ? `Delete and remove ${imageCount} photo${imageCount === 1 ? "" : "s"}` : "Delete permanently"} disabled={pending} />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}

export function BackToGallery() {
  return (
    <Link href="/admin/gallery" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
      ← All albums
    </Link>
  );
}
