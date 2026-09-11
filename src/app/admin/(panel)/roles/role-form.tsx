"use client";

import { useState } from "react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Panel } from "@/components/admin/page-header";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "@/server/actions/roles";

export type PermissionOption = { key: string; group: string; description: string; grantable: boolean };

export function RoleEditor({
  role,
  options,
}: {
  role: { id: string; name: string; description: string; permissions: string[] } | null;
  options: PermissionOption[];
}) {
  const { state, pending, onSubmit } = useFormAction(role ? updateRoleAction : createRoleAction);
  const [selected, setSelected] = useState(new Set(role?.permissions ?? []));
  const groups = [...new Set(options.map((o) => o.group))];
  const toggle = (key: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {role && <input type="hidden" name="roleId" value={role.id} />}
      <Panel title="Details">
        <div className="grid gap-4">
          <Field label="Role name" htmlFor="name" error={fieldErrorFor(state, "name")}>
            <Input id="name" name="name" defaultValue={role?.name} maxLength={40} required {...describedBy("name", fieldErrorFor(state, "name"))} />
          </Field>
          <Field label="What this role is for" htmlFor="description" error={fieldErrorFor(state, "description")}>
            <Textarea id="description" name="description" rows={2} defaultValue={role?.description} maxLength={200} />
          </Field>
        </div>
      </Panel>
      <Panel title="Permissions" description="Greyed-out permissions are ones you don't have yourself, so you can't hand them out.">
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((group) => {
            const inGroup = options.filter((o) => o.group === group);
            const editable = inGroup.filter((o) => o.grantable || selected.has(o.key));
            const allOn = editable.length > 0 && editable.every((o) => selected.has(o.key));
            return (
              <fieldset key={group} className="grid content-start gap-2">
                <legend className="flex w-full items-center justify-between gap-2 pb-1">
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-leaf">{group}</span>
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-frost"
                    onClick={() => editable.filter((o) => o.grantable).forEach((o) => toggle(o.key, !allOn))}
                  >
                    {allOn ? "Clear" : "Select all"}
                  </button>
                </legend>
                {inGroup.map((o) => {
                  const disabled = !o.grantable && !selected.has(o.key);
                  return (
                    <label key={o.key} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-raised/40 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-45">
                      <input
                        type="checkbox"
                        name="permissions"
                        value={o.key}
                        checked={selected.has(o.key)}
                        disabled={disabled}
                        onChange={(e) => toggle(o.key, e.target.checked)}
                        className="mt-0.5 size-4 accent-leaf"
                      />
                      <span className="grid gap-0.5">
                        <span className="text-sm">{o.description}</span>
                        <span className="font-mono text-[11px] text-muted">{o.key}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            );
          })}
        </div>
        {fieldErrorFor(state, "permissions") && <FormMessage>{fieldErrorFor(state, "permissions")}</FormMessage>}
      </Panel>
      <SaveBar state={state} pending={pending} label={role ? "Save role" : "Create role"} savedMessage="Role saved. Members get the new permissions on their next click." />
    </form>
  );
}

export function DeleteRoleForm({ roleId }: { roleId: string }) {
  const { state, pending, onSubmit } = useFormAction(deleteRoleAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="roleId" value={roleId} />
      <ConfirmSubmit label="Delete role" confirmLabel="Delete permanently" disabled={pending} />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
