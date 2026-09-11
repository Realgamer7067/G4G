"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { ImageUploadField, type UploadedImage } from "@/components/admin/image-upload-field";
import { Panel } from "@/components/admin/page-header";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SPONSOR_TIERS, SPONSOR_TIER_LABELS } from "@/lib/events/schema";
import { deleteSponsorAction, saveSponsorAction } from "@/server/actions/sponsors";

export type SponsorValues = {
  id: string | null;
  name: string;
  logo: UploadedImage | null;
  website: string;
  description: string;
  tier: (typeof SPONSOR_TIERS)[number];
  customLabel: string;
  showOnSponsorsPage: boolean;
  isActive: boolean;
  order: number;
};

export function SponsorForm({ values }: { values: SponsorValues }) {
  const { state, pending, onSubmit } = useFormAction(saveSponsorAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={err("name")} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={values.name} maxLength={80} required {...describedBy("name", err("name"))} />
          </Field>
          <Field label="Website" htmlFor="website" error={err("website")}>
            <Input id="website" name="website" type="url" defaultValue={values.website} placeholder="https://…" />
          </Field>
          <Field label="Partnership type" htmlFor="tier" error={err("tier")} hint="Default type; each event can use a different one.">
            <Select id="tier" name="tier" defaultValue={values.tier}>
              {SPONSOR_TIERS.map((t) => (
                <option key={t} value={t}>
                  {SPONSOR_TIER_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Custom label" htmlFor="customLabel" error={err("customLabel")} hint="Replaces the type on the sponsors page, e.g. “Cloud partner”.">
            <Input id="customLabel" name="customLabel" defaultValue={values.customLabel} maxLength={40} />
          </Field>
          <Field label="Sort order" htmlFor="order" error={err("order")} hint="Lower numbers appear first.">
            <Input id="order" name="order" type="number" min={0} defaultValue={values.order} />
          </Field>
          <Field label="Short description" htmlFor="description" error={err("description")} className="sm:col-span-2">
            <Textarea id="description" name="description" rows={2} defaultValue={values.description} maxLength={300} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Switch name="isActive" label="Active (can be added to events)" defaultChecked={values.isActive} />
          <Switch name="showOnSponsorsPage" label="Show on the Sponsors page" defaultChecked={values.showOnSponsorsPage} />
        </div>
      </Panel>
      <Panel title="Logo">
        <ImageUploadField name="logoId" purpose="SPONSOR" label="Sponsor logo" initial={values.logo} />
      </Panel>
      <SaveBar state={state} pending={pending} label={values.id ? "Save sponsor" : "Add sponsor"} />
    </form>
  );
}

export function DeleteSponsorForm({ id, eventCount }: { id: string; eventCount: number }) {
  const { state, pending, onSubmit } = useFormAction(deleteSponsorAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit
        label="Delete sponsor"
        confirmLabel={eventCount ? `Delete and remove from ${eventCount} event${eventCount === 1 ? "" : "s"}` : "Delete permanently"}
        disabled={pending}
      />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
