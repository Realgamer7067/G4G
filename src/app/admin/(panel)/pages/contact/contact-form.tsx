"use client";

import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Field, describedBy } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ContactContent } from "@/lib/pages/contact-schema";
import { saveContactContentAction } from "@/server/actions/page-content";

export function ContactForm({ values }: { values: ContactContent }) {
  const { state, pending, onSubmit } = useFormAction(saveContactContentAction);
  const err = (path: string) => fieldErrorFor(state, path);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Intro" htmlFor="intro" error={err("intro")}>
        <Textarea id="intro" name="intro" defaultValue={values.intro} rows={3} maxLength={500} {...describedBy("intro", err("intro"))} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm text-muted">Show on the page</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showEmail" defaultChecked={values.showEmail} className="accent-leaf" /> Email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showPhone" defaultChecked={values.showPhone} className="accent-leaf" /> Phone
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showAddress" defaultChecked={values.showAddress} className="accent-leaf" /> Address
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showMap" defaultChecked={values.showMap} className="accent-leaf" /> Map link
        </label>
      </fieldset>
      <SaveBar state={state} pending={pending} savedMessage="Contact page saved." />
    </form>
  );
}
