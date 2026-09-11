"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { SaveBar, errorsUnder, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { ImageUploadField, type UploadedImage } from "@/components/admin/image-upload-field";
import { Panel } from "@/components/admin/page-header";
import { RepeaterEditor } from "@/components/admin/repeater-editor";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MODE_LABELS, SPONSOR_TIERS, SPONSOR_TIER_LABELS } from "@/lib/events/schema";
import { slugify } from "@/lib/utils/slug";
import { cn } from "@/lib/utils/cn";
import { saveEventAction } from "@/server/actions/events";

type Mode = keyof typeof MODE_LABELS;
type Tier = (typeof SPONSOR_TIERS)[number];

export type EventEditorValues = {
  id: string | null;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  poster: UploadedImage | null;
  categoryId: string | null;
  startAt: string;
  endAt: string;
  venue: string;
  mode: Mode;
  onlineUrl: string;
  registrationMode: "NONE" | "EXTERNAL" | "FORM";
  externalRegistrationUrl: string;
  formId: string | null;
  registrationDeadline: string;
  maxParticipants: string;
  eligibility: string;
  organizers: { name: string; role: string; contact: string }[];
  contacts: { name: string; phone: string; email: string }[];
  links: { label: string; url: string }[];
  sponsors: { sponsorId: string; type: Tier; customLabel: string }[];
  showCountdown: boolean;
  countdownTarget: "START" | "DEADLINE";
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
};

export function EventEditor({
  values,
  categories,
  sponsors,
  forms,
  timezone,
}: {
  values: EventEditorValues;
  categories: { id: string; name: string }[];
  sponsors: { id: string; name: string }[];
  forms: { id: string; name: string; published: boolean }[];
  timezone: string;
}) {
  const { state, pending, onSubmit } = useFormAction(saveEventAction);
  const err = (p: string) => fieldErrorFor(state, p);
  const [title, setTitle] = useState(values.title);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(values.id));
  const [mode, setMode] = useState<Mode>(values.mode);
  const [registration, setRegistration] = useState(values.registrationMode);
  const [countdown, setCountdown] = useState(values.showCountdown);
  const [picked, setPicked] = useState(values.sponsors);
  const shownSlug = slugTouched ? slug : slugify(title);

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Panel title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event title" htmlFor="title" error={err("title")} className="sm:col-span-2">
            <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required {...describedBy("title", err("title"))} />
          </Field>
          <Field label="Page address" htmlFor="slug" error={err("slug")} hint={`The event page will live at /events/${shownSlug || "…"}`} className="sm:col-span-2">
            <div className="flex items-center overflow-hidden rounded-lg border border-line bg-night focus-within:border-leaf">
              <span className="pl-3 font-mono text-xs text-muted">/events/</span>
              <input
                id="slug"
                name="slug"
                value={shownSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                maxLength={80}
                className="h-10 min-w-0 flex-1 bg-transparent pr-3 font-mono text-sm text-frost focus:outline-none"
              />
            </div>
          </Field>
          <Field label="Tagline" htmlFor="tagline" error={err("tagline")} hint="One line shown on cards, e.g. “24 hours of building for first-years”." className="sm:col-span-2">
            <Input id="tagline" name="tagline" defaultValue={values.tagline} maxLength={160} />
          </Field>
          <Field label="Category" htmlFor="categoryId" error={err("categoryId")} hint={<Link href="/admin/events/categories" className="text-leaf hover:underline">Manage categories</Link>}>
            <Select id="categoryId" name="categoryId" defaultValue={values.categoryId ?? ""}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Switch name="featured" label="Feature on the homepage" defaultChecked={values.featured} />
          </div>
        </div>
      </Panel>

      <Panel title="Poster" description="Shown on event cards, the event page and social previews.">
        <ImageUploadField name="posterId" purpose="POSTER" label="Event poster" initial={values.poster} />
      </Panel>

      <Panel title="When & where" description={`Times are in ${timezone.replaceAll("_", " ")} (change it in Site settings).`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="startAt" error={err("startAt")}>
            <Input id="startAt" name="startAt" type="datetime-local" defaultValue={values.startAt} required {...describedBy("startAt", err("startAt"))} />
          </Field>
          <Field label="Ends" htmlFor="endAt" error={err("endAt")}>
            <Input id="endAt" name="endAt" type="datetime-local" defaultValue={values.endAt} required {...describedBy("endAt", err("endAt"))} />
          </Field>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-1.5 text-[13px] font-medium">Format</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                <label key={m} className="cursor-pointer rounded-xl border border-line bg-night px-3 py-2.5 text-center text-sm text-muted transition-colors has-[:checked]:border-leaf/50 has-[:checked]:bg-leaf/10 has-[:checked]:text-frost has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint">
                  <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
                  {MODE_LABELS[m]}
                </label>
              ))}
            </div>
          </fieldset>
          {mode !== "ONLINE" && (
            <Field label="Venue" htmlFor="venue" error={err("venue")} className={mode === "HYBRID" ? undefined : "sm:col-span-2"}>
              <Input id="venue" name="venue" defaultValue={values.venue} maxLength={200} placeholder="e.g. Seminar Hall 2, AB-2" />
            </Field>
          )}
          {mode !== "OFFLINE" && (
            <Field label="Online link" htmlFor="onlineUrl" error={err("onlineUrl")} hint="Meet, Zoom or YouTube link. Shown on the event page." className={mode === "HYBRID" ? undefined : "sm:col-span-2"}>
              <Input id="onlineUrl" name="onlineUrl" type="url" defaultValue={values.onlineUrl} placeholder="https://…" />
            </Field>
          )}
        </div>
      </Panel>

      <Panel title="About the event">
        <div className="grid gap-1.5">
          <Label htmlFor="description" id="description-label">
            Description
          </Label>
          <RichTextEditor id="description" name="description" initialHtml={values.description} />
          <FormMessage>{err("description")}</FormMessage>
        </div>
        <Field label="Who can attend" htmlFor="eligibility" error={err("eligibility")} hint="e.g. “Open to all B.Tech students. Teams of 2–4.”">
          <Textarea id="eligibility" name="eligibility" rows={2} defaultValue={values.eligibility} maxLength={500} />
        </Field>
      </Panel>

      <Panel title="Registration">
        <fieldset className="grid gap-2">
          <legend className="sr-only">How do people register?</legend>
          {[
            { value: "NONE", title: "No registration", body: "People just turn up. No Register button is shown." },
            { value: "FORM", title: "Registration form on this site", body: "People press “Join event” and fill in a step-by-step form you built in Forms." },
            { value: "EXTERNAL", title: "External link", body: "Send people to a registration page elsewhere, like Unstop, Devfolio or a Google Form." },
          ].map((o) => (
            <label key={o.value} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-night/50 p-3 has-[:checked]:border-leaf/50 has-[:checked]:bg-leaf/5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint">
              <input
                type="radio"
                name="registrationMode"
                value={o.value}
                checked={registration === o.value}
                onChange={() => setRegistration(o.value as EventEditorValues["registrationMode"])}
                className="mt-1 accent-leaf"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{o.title}</span>
                <span className="text-xs text-muted">{o.body}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {registration !== "NONE" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {registration === "EXTERNAL" ? (
              <Field label="Registration link" htmlFor="externalRegistrationUrl" error={err("externalRegistrationUrl")} className="sm:col-span-2">
                <Input id="externalRegistrationUrl" name="externalRegistrationUrl" type="url" defaultValue={values.externalRegistrationUrl} placeholder="https://…" {...describedBy("externalRegistrationUrl", err("externalRegistrationUrl"))} />
              </Field>
            ) : (
              <Field
                label="Registration form"
                htmlFor="formId"
                error={err("formId")}
                className="sm:col-span-2"
                hint={
                  <>
                    Only published forms accept registrations. Tip: set the form to “Event only” so it isn&apos;t reachable on its own.{" "}
                    <Link href="/admin/forms/new" className="text-leaf hover:underline">
                      Create a form
                    </Link>
                  </>
                }
              >
                <Select id="formId" name="formId" defaultValue={values.formId ?? ""} {...describedBy("formId", err("formId"))}>
                  <option value="">Choose a form</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.published ? "" : " (not published yet)"}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Registration closes" htmlFor="registrationDeadline" error={err("registrationDeadline")} hint="Leave empty to close when the event starts.">
              <Input id="registrationDeadline" name="registrationDeadline" type="datetime-local" defaultValue={values.registrationDeadline} />
            </Field>
            <Field
              label="Seats"
              htmlFor="maxParticipants"
              error={err("maxParticipants")}
              hint={registration === "FORM" ? "Registration closes automatically when this many people have registered." : "Optional. Shown on the event page."}
            >
              <Input id="maxParticipants" name="maxParticipants" type="number" min={1} inputMode="numeric" defaultValue={values.maxParticipants} />
            </Field>
          </div>
        )}
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2 sm:items-end">
          <Switch name="showCountdown" label="Show a countdown on the event page" checked={countdown} onChange={(e) => setCountdown(e.target.checked)} />
          {countdown && (
            <Field label="Count down to" htmlFor="countdownTarget" error={err("countdownTarget")}>
              <Select id="countdownTarget" name="countdownTarget" defaultValue={values.countdownTarget}>
                <option value="START">The event start</option>
                <option value="DEADLINE">Registration closing</option>
              </Select>
            </Field>
          )}
        </div>
      </Panel>

      <Panel title="People & links">
        <div className="grid gap-2">
          <p className="text-[13px] font-medium">Organizers</p>
          <RepeaterEditor
            name="organizers"
            initial={values.organizers}
            max={12}
            addLabel="Add organizer"
            fields={[
              { key: "name", label: "Name" },
              { key: "role", label: "Role", placeholder: "Role, e.g. Event lead" },
              { key: "contact", label: "Contact", placeholder: "Email or profile link" },
            ]}
          />
          {errorsUnder(state, "organizers").slice(0, 1).map((m) => <FormMessage key={m}>{m}</FormMessage>)}
        </div>
        <div className="grid gap-2">
          <p className="text-[13px] font-medium">Contacts for questions</p>
          <RepeaterEditor
            name="contacts"
            initial={values.contacts}
            max={6}
            addLabel="Add contact"
            fields={[
              { key: "name", label: "Name" },
              { key: "phone", label: "Phone", type: "tel" },
              { key: "email", label: "Email", type: "email" },
            ]}
          />
          {errorsUnder(state, "contacts").slice(0, 1).map((m) => <FormMessage key={m}>{m}</FormMessage>)}
        </div>
        <div className="grid gap-2">
          <p className="text-[13px] font-medium">Useful links</p>
          <RepeaterEditor
            name="links"
            initial={values.links}
            max={10}
            addLabel="Add link"
            fields={[
              { key: "label", label: "Label", placeholder: "e.g. Rulebook", width: "1fr" },
              { key: "url", label: "Link", placeholder: "https://…", type: "url", width: "1.6fr" },
            ]}
          />
          {errorsUnder(state, "links").slice(0, 1).map((m) => <FormMessage key={m}>{m}</FormMessage>)}
        </div>
      </Panel>

      <Panel title="Sponsors & partners" description="Pick from your sponsor list. Cards show only the title sponsor or “Powered by”; the event page shows all.">
        <input type="hidden" name="sponsors" value={JSON.stringify(picked)} />
        {picked.length === 0 && <p className="text-sm text-muted">No sponsors on this event.</p>}
        {picked.map((p, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center">
            <Select aria-label={`Sponsor ${index + 1}`} value={p.sponsorId} onChange={(e) => setPicked((l) => l.map((x, i) => (i === index ? { ...x, sponsorId: e.target.value } : x)))}>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select aria-label={`Sponsor ${index + 1} type`} value={p.type} onChange={(e) => setPicked((l) => l.map((x, i) => (i === index ? { ...x, type: e.target.value as Tier } : x)))}>
              {SPONSOR_TIERS.map((t) => (
                <option key={t} value={t}>
                  {SPONSOR_TIER_LABELS[t]}
                </option>
              ))}
            </Select>
            <Input aria-label={`Sponsor ${index + 1} custom label`} placeholder="Custom label (optional)" value={p.customLabel} maxLength={40} onChange={(e) => setPicked((l) => l.map((x, i) => (i === index ? { ...x, customLabel: e.target.value } : x)))} />
            <button type="button" aria-label="Remove sponsor" onClick={() => setPicked((l) => l.filter((_, i) => i !== index))} className="justify-self-end rounded-md p-1.5 text-muted hover:bg-raised hover:text-danger">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          {sponsors.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPicked((l) => [...l, { sponsorId: sponsors[0].id, type: "PARTNER", customLabel: "" }])}>
              <Plus className="size-4" aria-hidden="true" /> Add sponsor
            </Button>
          ) : (
            <p className="text-sm text-muted">Your sponsor list is empty.</p>
          )}
          <Link href="/admin/sponsors" className="text-sm text-leaf hover:underline">
            Manage sponsors
          </Link>
        </div>
      </Panel>

      <Panel title="Search & sharing">
        <details className={cn("group", (err("seoTitle") || err("seoDescription")) && "open")} open={Boolean(values.seoTitle || values.seoDescription) || undefined}>
          <summary className="cursor-pointer text-sm text-muted hover:text-frost">Custom title and description (optional)</summary>
          <div className="mt-4 grid gap-4">
            <Field label="Search title" htmlFor="seoTitle" error={err("seoTitle")} hint="Defaults to the event title.">
              <Input id="seoTitle" name="seoTitle" defaultValue={values.seoTitle} maxLength={70} />
            </Field>
            <Field label="Search description" htmlFor="seoDescription" error={err("seoDescription")} hint="Defaults to the tagline or the start of the description.">
              <Textarea id="seoDescription" name="seoDescription" rows={2} defaultValue={values.seoDescription} maxLength={200} />
            </Field>
          </div>
        </details>
      </Panel>

      <SaveBar state={state} pending={pending} label={values.id ? "Save changes" : "Create draft"} savedMessage="Saved. Published events update on the website right away." />
    </form>
  );
}
