"use client";

import { fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { createFormAction } from "@/server/actions/forms";

export function NewFormForm() {
  const { state, pending, onSubmit } = useFormAction(createFormAction);
  const err = fieldErrorFor(state, "name");
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Form name" htmlFor="name" error={err} hint="e.g. “Web Team Recruitment 2026” or “Code Sprint registration”.">
        <Input id="name" name="name" maxLength={120} required autoFocus {...describedBy("name", err)} />
      </Field>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Creating…" : "Create and open builder"}
      </Button>
    </form>
  );
}
