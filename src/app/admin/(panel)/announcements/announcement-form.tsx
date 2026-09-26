"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Panel } from "@/components/admin/page-header";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ANNOUNCEMENT_PRIORITIES, ANNOUNCEMENT_PRIORITY_LABELS } from "@/lib/announcements/schema";
import { deleteAnnouncementAction, saveAnnouncementAction } from "@/server/actions/announcements";

export type AnnouncementFormValues = {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  content: string;
  publishAt: string;
  expiresAt: string;
  linkUrl: string;
  linkLabel: string;
  priority: (typeof ANNOUNCEMENT_PRIORITIES)[number];
  pinned: boolean;
  showOnHomepage: boolean;
  showAsBanner: boolean;
};

export function AnnouncementForm({ values, timezone }: { values: AnnouncementFormValues; timezone: string }) {
  const { state, pending, onSubmit } = useFormAction(saveAnnouncementAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <Panel title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor="title" error={err("title")} className="sm:col-span-2">
            <Input id="title" name="title" defaultValue={values.title} maxLength={160} required {...describedBy("title", err("title"))} />
          </Field>
          <Field label="Page address" htmlFor="slug" error={err("slug")} hint="Leave blank to generate one from the title." className="sm:col-span-2">
            <div className="flex items-center overflow-hidden rounded-lg border border-line bg-night focus-within:border-leaf">
              <span className="pl-3 font-mono text-xs text-muted">/announcements/</span>
              <input id="slug" name="slug" defaultValue={values.slug} maxLength={80} className="h-10 min-w-0 flex-1 bg-transparent pr-3 font-mono text-sm text-frost focus:outline-none" />
            </div>
          </Field>
          <Field label="Summary" htmlFor="summary" error={err("summary")} hint="Shown on lists, the homepage and the banner." className="sm:col-span-2">
            <Textarea id="summary" name="summary" rows={2} defaultValue={values.summary} maxLength={240} />
          </Field>
        </div>
      </Panel>

      <Panel title="Details page">
        <div className="grid gap-1.5">
          <Label htmlFor="content" id="content-label">
            Content
          </Label>
          <RichTextEditor id="content" name="content" initialHtml={values.content} placeholder="Write the full announcement…" />
          <FormMessage>{err("content")}</FormMessage>
        </div>
      </Panel>

      <Panel title="Timing" description={`Times are in ${timezone.replaceAll("_", " ")} (change it in Site settings).`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Publishes at" htmlFor="publishAt" error={err("publishAt")} hint="When it becomes visible. Can be in the future.">
            <Input id="publishAt" name="publishAt" type="datetime-local" defaultValue={values.publishAt} required {...describedBy("publishAt", err("publishAt"))} />
          </Field>
          <Field label="Expires at" htmlFor="expiresAt" error={err("expiresAt")} hint="Optional. Hidden automatically after this time.">
            <Input id="expiresAt" name="expiresAt" type="datetime-local" defaultValue={values.expiresAt} />
          </Field>
        </div>
      </Panel>

      <Panel title="Link" description="Optional call-to-action shown on cards and the banner.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link address" htmlFor="linkUrl" error={err("linkUrl")}>
            <Input id="linkUrl" name="linkUrl" type="url" defaultValue={values.linkUrl} placeholder="https://…" />
          </Field>
          <Field label="Link label" htmlFor="linkLabel" error={err("linkLabel")} hint='e.g. "Register now"'>
            <Input id="linkLabel" name="linkLabel" defaultValue={values.linkLabel} maxLength={40} />
          </Field>
        </div>
      </Panel>

      <Panel title="Visibility">
        <Field label="Priority" htmlFor="priority" error={err("priority")} hint="Controls colour and which announcement wins the banner slot.">
          <Select id="priority" name="priority" defaultValue={values.priority}>
            {ANNOUNCEMENT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {ANNOUNCEMENT_PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap gap-6">
          <Switch name="pinned" label="Pin to the top of the list" defaultChecked={values.pinned} />
          <Switch name="showOnHomepage" label="Show on the homepage" defaultChecked={values.showOnHomepage} />
          <Switch name="showAsBanner" label="Show as the site-wide banner" defaultChecked={values.showAsBanner} />
        </div>
      </Panel>

      <SaveBar state={state} pending={pending} label={values.id ? "Save changes" : "Create draft"} savedMessage="Saved. Published announcements update on the website right away." />
    </form>
  );
}

export function DeleteAnnouncementForm({ id }: { id: string }) {
  const { state, pending, onSubmit } = useFormAction(deleteAnnouncementAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit label="Delete announcement" confirmLabel="Delete permanently" disabled={pending} />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
