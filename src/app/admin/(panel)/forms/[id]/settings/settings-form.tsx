"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { ImageUploadField, type UploadedImage } from "@/components/admin/image-upload-field";
import { Panel } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteFormAction, duplicateFormAction, saveFormSettingsAction } from "@/server/actions/forms";

export type FormSettingsValues = {
  id: string;
  name: string;
  slug: string;
  description: string;
  cover: UploadedImage | null;
  visibility: "PUBLIC_LINK" | "EVENT_ONLY";
  acceptingResponses: boolean;
  opensAt: string;
  closesAt: string;
  maxResponses: string;
  oneResponsePerEmail: boolean;
  successMessage: string;
  submitLabel: string;
  reviewStep: boolean;
};

export function FormSettingsForm({ values, timezone }: { values: FormSettingsValues; timezone: string }) {
  const { state, pending, onSubmit } = useFormAction(saveFormSettingsAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <input type="hidden" name="id" value={values.id} />
      <Panel title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Form name" htmlFor="name" error={err("name")}>
            <Input id="name" name="name" defaultValue={values.name} maxLength={120} required {...describedBy("name", err("name"))} />
          </Field>
          <Field label="Link" htmlFor="slug" error={err("slug")} hint="The form's address: /forms/…">
            <Input id="slug" name="slug" defaultValue={values.slug} maxLength={80} className="font-mono" />
          </Field>
          <Field label="Introduction" htmlFor="description" error={err("description")} className="sm:col-span-2" hint="Shown under the first page's title.">
            <Textarea id="description" name="description" rows={3} defaultValue={values.description} maxLength={1000} />
          </Field>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[13px] font-medium">Where people fill it in</legend>
          {[
            { value: "PUBLIC_LINK", title: "Its own link", body: "Anyone with /forms/… can open it. Good for recruitment and surveys." },
            { value: "EVENT_ONLY", title: "Event registration only", body: "Only reachable through an event's “Join event” button." },
          ].map((o) => (
            <label key={o.value} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-night/50 p-3 has-[:checked]:border-leaf/50 has-[:checked]:bg-leaf/5">
              <input type="radio" name="visibility" value={o.value} defaultChecked={values.visibility === o.value} className="mt-1 accent-leaf" />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{o.title}</span>
                <span className="text-xs text-muted">{o.body}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <ImageUploadField name="coverId" purpose="COVER" label="Cover image (optional)" initial={values.cover} description="Shown in the form's side panel. Event registrations use the event poster instead." />
      </Panel>

      <Panel title="Responses" description={`Times are in ${timezone.replaceAll("_", " ")}.`}>
        <Switch name="acceptingResponses" label="Accepting responses" defaultChecked={values.acceptingResponses} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Opens" htmlFor="opensAt" error={err("opensAt")} hint="Optional">
            <Input id="opensAt" name="opensAt" type="datetime-local" defaultValue={values.opensAt} />
          </Field>
          <Field label="Closes" htmlFor="closesAt" error={err("closesAt")} hint="Optional">
            <Input id="closesAt" name="closesAt" type="datetime-local" defaultValue={values.closesAt} />
          </Field>
          <Field label="Maximum responses" htmlFor="maxResponses" error={err("maxResponses")} hint="Optional">
            <Input id="maxResponses" name="maxResponses" type="number" min={1} defaultValue={values.maxResponses} />
          </Field>
        </div>
        <Switch name="oneResponsePerEmail" label="Allow one response per email address" defaultChecked={values.oneResponsePerEmail} />
      </Panel>

      <Panel title="Submitting">
        <Switch name="reviewStep" label="Show a “Check it over” review step before submitting" defaultChecked={values.reviewStep} />
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <Field label="Submit button" htmlFor="submitLabel" error={err("submitLabel")}>
            <Input id="submitLabel" name="submitLabel" defaultValue={values.submitLabel} maxLength={40} placeholder="e.g. Confirm booking" />
          </Field>
          <Field label="Message after submitting" htmlFor="successMessage" error={err("successMessage")}>
            <Textarea id="successMessage" name="successMessage" rows={2} defaultValue={values.successMessage} maxLength={500} />
          </Field>
        </div>
      </Panel>

      <SaveBar state={state} pending={pending} label="Save settings" />
    </form>
  );
}

export function DangerZone({ id, canDuplicate, canDelete }: { id: string; canDuplicate: boolean; canDelete: boolean }) {
  const duplicate = useFormAction(duplicateFormAction);
  const remove = useFormAction(deleteFormAction);
  return (
    <div className="flex flex-wrap items-start gap-3">
      {canDuplicate && (
        <form onSubmit={duplicate.onSubmit}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="secondary" size="sm" disabled={duplicate.pending}>
            Duplicate form
          </Button>
        </form>
      )}
      {canDelete && (
        <form onSubmit={remove.onSubmit} className="grid gap-1">
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit label="Delete form" confirmLabel="Delete form and all responses" disabled={remove.pending} />
          {remove.state && !remove.state.ok && <FormMessage>{remove.state.error}</FormMessage>}
        </form>
      )}
      {duplicate.state && !duplicate.state.ok && <FormMessage>{duplicate.state.error}</FormMessage>}
    </div>
  );
}
