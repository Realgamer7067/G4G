"use client";

import { Loader2, UserPlus } from "lucide-react";
import { CopyButton } from "@/components/admin/copy-button";
import { fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createInviteAction } from "@/server/actions/admins";

export function InviteForm({ roles }: { roles: { id: string; name: string }[] }) {
  const { state, pending, onSubmit } = useFormAction(createInviteAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <div className="grid gap-4">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Email" htmlFor="invite-email" error={err("email")}>
          <Input id="invite-email" name="email" type="email" autoComplete="off" required {...describedBy("invite-email", err("email"))} />
        </Field>
        <Field label="Role" htmlFor="invite-role" error={err("roleId")}>
          <Select id="invite-role" name="roleId" defaultValue="" required>
            <option value="" disabled>
              Choose a role
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
          Create invite link
        </Button>
      </form>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.error}</FormMessage>}
      {state?.ok && (
        <div role="status" className="grid gap-3 rounded-xl border border-leaf/30 bg-leaf/5 p-4">
          <p className="text-sm">
            Invite link for <strong>{state.data.email}</strong>. Send it privately: anyone with the link can create this account. It works
            once and expires in 72 hours.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-night px-3 py-2 font-mono text-xs">{state.data.url}</code>
            <CopyButton value={state.data.url} />
          </div>
        </div>
      )}
    </div>
  );
}
