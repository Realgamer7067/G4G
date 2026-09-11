"use client";

import { SaveBar, errorsUnder, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { ImageUploadField, type UploadedImage } from "@/components/admin/image-upload-field";
import { LinkListEditor } from "@/components/admin/link-list-editor";
import { Panel } from "@/components/admin/page-header";
import { FormMessage } from "@/components/ui/form-message";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_NETWORKS, type FooterSettings, type NavCta, type Socials } from "@/lib/settings/schema";
import { updateSiteSettingsAction } from "@/server/actions/settings";
import { FooterColumnsEditor } from "./footer-columns-editor";

export type SettingsFormValues = {
  clubName: string;
  shortName: string;
  tagline: string;
  description: string;
  universityName: string;
  email: string;
  phone: string;
  address: string;
  mapUrl: string;
  timezone: string;
  logo: UploadedImage | null;
  ogImage: UploadedImage | null;
  socials: Socials;
  footer: FooterSettings;
  seo: { titleTemplate: string; defaultDescription: string };
  navCta: NavCta | null;
};

const SOCIAL_LABELS: Record<(typeof SOCIAL_NETWORKS)[number], string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  github: "GitHub",
  youtube: "YouTube",
  discord: "Discord invite",
  whatsapp: "WhatsApp group or channel",
  x: "X (Twitter)",
};

export function SettingsForm({ values, timezones }: { values: SettingsFormValues; timezones: string[] }) {
  const { state, pending, onSubmit } = useFormAction(updateSiteSettingsAction);
  const err = (path: string) => fieldErrorFor(state, path);

  const text = (name: string, label: string, value: string, opts: { hint?: string; type?: string; max?: number; full?: boolean; required?: boolean } = {}) => (
    <Field key={name} label={label} htmlFor={name} hint={opts.hint} error={err(name)} className={opts.full ? "sm:col-span-2" : undefined}>
      <Input id={name} name={name} type={opts.type ?? "text"} defaultValue={value} maxLength={opts.max} required={opts.required} {...describedBy(name, err(name))} />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      <Panel title="Club identity" description="Shown in the header, footer and search results.">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("clubName", "Club name", values.clubName, { max: 100, required: true })}
          {text("shortName", "Short name", values.shortName, { max: 40, required: true, hint: "Used where space is tight, like the mobile header." })}
          {text("tagline", "Tagline", values.tagline, { max: 140, full: true })}
          <Field label="Description" htmlFor="description" error={err("description")} className="sm:col-span-2" hint="Two or three sentences about what the chapter does.">
            <Textarea id="description" name="description" defaultValue={values.description} maxLength={600} {...describedBy("description", err("description"))} />
          </Field>
          {text("universityName", "University", values.universityName, { max: 120, full: true })}
        </div>
        <ImageUploadField
          name="logoId"
          purpose="LOGO"
          label="Custom logo (optional)"
          description="Leave empty to use the original chapter logo on its light tile."
          initial={values.logo}
        />
      </Panel>

      <Panel title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("email", "Official email", values.email, { type: "email", max: 254 })}
          {text("phone", "Phone", values.phone, { type: "tel", max: 40 })}
          <Field label="Address" htmlFor="address" error={err("address")} className="sm:col-span-2">
            <Textarea id="address" name="address" rows={2} defaultValue={values.address} maxLength={300} />
          </Field>
          {text("mapUrl", "Map link", values.mapUrl, { type: "url", hint: "A Google Maps or OpenStreetMap link to the campus or venue." })}
          <Field label="Time zone" htmlFor="timezone" error={err("timezone")} hint="Event dates and deadlines are shown in this time zone.">
            <Select id="timezone" name="timezone" defaultValue={values.timezone}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel title="Social links" description="Leave a network empty to hide it.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_NETWORKS.map((network) =>
            text(`socials.${network}`, SOCIAL_LABELS[network], values.socials[network], { type: "url", hint: undefined }),
          )}
        </div>
        <div className="grid gap-2">
          <p className="text-[13px] font-medium">Other links</p>
          <LinkListEditor name="socials.custom" hrefKey="url" initial={values.socials.custom} max={6} hrefPlaceholder="https://…" />
          {errorsUnder(state, "socials.custom").slice(0, 1).map((m) => (
            <FormMessage key={m}>{m}</FormMessage>
          ))}
        </div>
      </Panel>

      <Panel title="Header button" description="Optional button at the end of the menu, like “Join us” linking to a form.">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("navCta.label", "Button text", values.navCta?.label ?? "", { max: 30 })}
          {text("navCta.href", "Button link", values.navCta?.href ?? "", { hint: "A page on this site (/forms/join) or a full https:// link." })}
        </div>
      </Panel>

      <Panel title="Footer">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Short blurb" htmlFor="footer.blurb" error={err("footer.blurb")} className="sm:col-span-2">
            <Textarea id="footer.blurb" name="footer.blurb" rows={2} defaultValue={values.footer.blurb} maxLength={300} />
          </Field>
          {text("footer.copyright", "Copyright line", values.footer.copyright, { max: 120, hint: "The current year is added automatically." })}
        </div>
        <div className="grid gap-2">
          <p className="text-[13px] font-medium">Link columns</p>
          <FooterColumnsEditor initial={values.footer.columns} />
          {errorsUnder(state, "footer.columns").slice(0, 1).map((m) => (
            <FormMessage key={m}>{m}</FormMessage>
          ))}
        </div>
      </Panel>

      <Panel title="Search & sharing" description="Defaults for pages that don't set their own.">
        <div className="grid gap-4">
          {text("seo.titleTemplate", "Title template", values.seo.titleTemplate, {
            max: 80,
            hint: "%s is replaced by the page title, e.g. “Events · GFG Student Chapter”.",
          })}
          <Field label="Default description" htmlFor="seo.defaultDescription" error={err("seo.defaultDescription")} hint="About 150 characters. Shown under the link in search results.">
            <Textarea id="seo.defaultDescription" name="seo.defaultDescription" rows={2} defaultValue={values.seo.defaultDescription} maxLength={200} />
          </Field>
        </div>
        <ImageUploadField name="seo.ogImageId" purpose="COVER" label="Default share image" initial={values.ogImage} description="Shown when a page is shared on WhatsApp, LinkedIn or X. Landscape 16:9, 1600 × 900 recommended." />
      </Panel>

      <SaveBar state={state} pending={pending} savedMessage="Settings saved. The live site is updated." />
    </form>
  );
}
