"use client";

import { fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { acceptInviteAction } from "@/server/actions/invite";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const { state, pending, onSubmit } = useFormAction(acceptInviteAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field label="Email" htmlFor="email" hint="Invites are tied to one email address.">
        <Input id="email" value={email} readOnly autoComplete="username" />
      </Field>
      <Field label="Your name" htmlFor="name" error={err("name")}>
        <Input id="name" name="name" autoComplete="name" maxLength={80} required {...describedBy("name", err("name"))} />
      </Field>
      <Field label="Password" htmlFor="password" error={err("password")} hint="At least 12 characters. A short sentence works well.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required {...describedBy("password", err("password"))} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={err("confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required {...describedBy("confirm", err("confirm"))} />
      </Field>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
