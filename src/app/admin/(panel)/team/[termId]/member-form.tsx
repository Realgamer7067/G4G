// src/app/admin/(panel)/team/[termId]/member-form.tsx
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
import { TEAM_TIERS, TEAM_TIER_LABELS, type TeamTier } from "@/lib/team/schema";
import { deleteTeamMemberAction, saveTeamMemberAction } from "@/server/actions/team-members";

export type MemberValues = {
  id: string | null;
  name: string;
  photo: UploadedImage | null;
  title: string;
  tier: TeamTier;
  domainId: string;
  bio: string;
  links: { linkedin: string; github: string; instagram: string; website: string; x: string };
  featured: boolean;
};

export function MemberForm({
  term,
  domains,
  values,
}: {
  term: { id: string; label: string };
  domains: { id: string; name: string }[];
  values: MemberValues;
}) {
  const { state, pending, onSubmit } = useFormAction(saveTeamMemberAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="termId" value={term.id} />
      <Panel title="Details" description={`Added to the ${term.label} term.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={err("name")}>
            <Input id="name" name="name" defaultValue={values.name} maxLength={80} required {...describedBy("name", err("name"))} />
          </Field>
          <Field label="Title" htmlFor="title" error={err("title")} hint="e.g. Chapter Lead, Design Domain Lead.">
            <Input id="title" name="title" defaultValue={values.title} maxLength={60} required {...describedBy("title", err("title"))} />
          </Field>
          <Field label="Tier" htmlFor="tier" error={err("tier")}>
            <Select id="tier" name="tier" defaultValue={values.tier}>
              {TEAM_TIERS.map((t) => (
                <option key={t} value={t}>
                  {TEAM_TIER_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Domain" htmlFor="domainId" error={err("domainId")} hint="Used for Domain Lead and Member tiers.">
            <Select id="domainId" name="domainId" defaultValue={values.domainId}>
              <option value="">No domain</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bio" htmlFor="bio" error={err("bio")} className="sm:col-span-2">
            <Textarea id="bio" name="bio" rows={3} defaultValue={values.bio} maxLength={600} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Switch name="featured" label="Feature on the homepage" defaultChecked={values.featured} />
        </div>
      </Panel>
      <Panel title="Photo">
        <ImageUploadField name="photoId" purpose="TEAM" label="Team photo" initial={values.photo} />
      </Panel>
      <Panel title="Links">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn" htmlFor="links.linkedin" error={err("links.linkedin")}>
            <Input id="links.linkedin" name="links.linkedin" type="url" {...describedBy("links.linkedin", err("links.linkedin"))} defaultValue={values.links.linkedin} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="GitHub" htmlFor="links.github" error={err("links.github")}>
            <Input id="links.github" name="links.github" type="url" {...describedBy("links.github", err("links.github"))} defaultValue={values.links.github} placeholder="https://github.com/…" />
          </Field>
          <Field label="Instagram" htmlFor="links.instagram" error={err("links.instagram")}>
            <Input id="links.instagram" name="links.instagram" type="url" {...describedBy("links.instagram", err("links.instagram"))} defaultValue={values.links.instagram} placeholder="https://instagram.com/…" />
          </Field>
          <Field label="Website" htmlFor="links.website" error={err("links.website")}>
            <Input id="links.website" name="links.website" type="url" {...describedBy("links.website", err("links.website"))} defaultValue={values.links.website} placeholder="https://…" />
          </Field>
          <Field label="X" htmlFor="links.x" error={err("links.x")}>
            <Input id="links.x" name="links.x" type="url" {...describedBy("links.x", err("links.x"))} defaultValue={values.links.x} placeholder="https://x.com/…" />
          </Field>
        </div>
      </Panel>
      <SaveBar state={state} pending={pending} label={values.id ? "Save member" : "Add member"} />
    </form>
  );
}

export function DeleteMemberForm({ id, name }: { id: string; name: string }) {
  const { state, pending, onSubmit } = useFormAction(deleteTeamMemberAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit label="Delete member" confirmLabel={`Delete ${name}`} disabled={pending} />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
