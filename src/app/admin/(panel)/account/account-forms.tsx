"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/actions";
import { changePasswordAction, updateProfileAction } from "@/server/actions/account";

function fieldError(state: ActionResult | undefined, field: string) {
  return state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, undefined);
  const nameError = fieldError(state, "name");
  return (
    <form action={action} className="grid gap-4 sm:max-w-sm">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={name}
          maxLength={80}
          required
          aria-invalid={!!nameError}
          aria-describedby="name-error"
        />
        <FormMessage id="name-error">{nameError}</FormMessage>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save name"}
        </Button>
        {state?.ok && <FormMessage tone="success">Name saved.</FormMessage>}
        {state && !state.ok && !nameError && <FormMessage>{state.error}</FormMessage>}
      </div>
    </form>
  );
}

const PASSWORD_FIELDS = [
  { name: "current", label: "Current password", autoComplete: "current-password" },
  { name: "next", label: "New password", autoComplete: "new-password", hint: "At least 12 characters. A short sentence works well." },
  { name: "confirm", label: "Confirm new password", autoComplete: "new-password" },
] as const;

export function PasswordForm() {
  // React resets the form after the action completes, so a successful change clears the fields.
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="grid gap-4 sm:max-w-sm">
      {PASSWORD_FIELDS.map((f) => {
        const error = fieldError(state, f.name);
        return (
          <div key={f.name} className="grid gap-1.5">
            <Label htmlFor={`pw-${f.name}`}>{f.label}</Label>
            <Input
              id={`pw-${f.name}`}
              name={f.name}
              type="password"
              autoComplete={f.autoComplete}
              required
              aria-invalid={!!error}
              aria-describedby={`pw-${f.name}-msg`}
            />
            {"hint" in f && !error && <p className="text-xs text-muted">{f.hint}</p>}
            <FormMessage id={`pw-${f.name}-msg`}>{error}</FormMessage>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </Button>
        {state?.ok && <FormMessage tone="success">Password changed. Other sessions were signed out.</FormMessage>}
        {state && !state.ok && !state.fieldErrors && <FormMessage>{state.error}</FormMessage>}
      </div>
    </form>
  );
}
