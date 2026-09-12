"use client";

import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AboutContent } from "@/lib/pages/about-schema";
import { saveAboutContentAction } from "@/server/actions/page-content";

export function AboutForm({ values }: { values: AboutContent }) {
  const { state, pending, onSubmit } = useFormAction(saveAboutContentAction);
  const err = (path: string) => fieldErrorFor(state, path);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Heading" htmlFor="heading" error={err("heading")}>
        <Input id="heading" name="heading" defaultValue={values.heading} maxLength={80} {...describedBy("heading", err("heading"))} />
      </Field>
      <Field label="Body" htmlFor="body" hint="One paragraph per line." error={err("body")}>
        <Textarea id="body" name="body" defaultValue={values.body} rows={10} maxLength={4000} {...describedBy("body", err("body"))} />
      </Field>
      <input type="hidden" name="imageId" value={values.imageId ?? ""} />
      <SaveBar state={state} pending={pending} savedMessage="About page saved." />
    </form>
  );
}
