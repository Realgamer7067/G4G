"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";
import { saveOverridesAction, setAdminActiveAction, updateAdminRoleAction } from "@/server/actions/admins";

export function RoleForm({ userId, roleId, roles }: { userId: string; roleId: string; roles: { id: string; name: string }[] }) {
  const { state, pending, onSubmit } = useFormAction(updateAdminRoleAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid min-w-56 flex-1 gap-1.5">
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="roleId" defaultValue={roleId}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Change role"}
      </Button>
      {state?.ok && <FormMessage tone="success">Role updated.</FormMessage>}
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}

export function StatusForm({ userId, isActive }: { userId: string; isActive: boolean }) {
  const { state, pending, onSubmit } = useFormAction(setAdminActiveAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      {isActive ? (
        <ConfirmSubmit label="Deactivate account" confirmLabel="Deactivate and sign out" disabled={pending} />
      ) : (
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          Reactivate account
        </Button>
      )}
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}

export type OverrideRow = {
  key: string;
  description: string;
  group: string;
  fromRole: boolean;
  override: "inherit" | "grant" | "deny";
  grantable: boolean;
};

const CHOICES = [
  { value: "inherit", label: "Role" },
  { value: "grant", label: "Allow" },
  { value: "deny", label: "Block" },
] as const;

export function OverridesForm({ userId, rows }: { userId: string; rows: OverrideRow[] }) {
  const { state, pending, onSubmit } = useFormAction(saveOverridesAction);
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name="userId" value={userId} />
      {groups.map((group) => (
        <fieldset key={group} className="grid gap-1">
          <legend className="mb-2 font-mono text-[11px] uppercase tracking-[0.1em] text-leaf">{group}</legend>
          {rows
            .filter((r) => r.group === group)
            .map((r) => (
              <div key={r.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-raised/40">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm">{r.description}</span>
                  <span className="font-mono text-[11px] text-muted">
                    {r.key} · role {r.fromRole ? "allows" : "doesn't allow"}
                  </span>
                </div>
                <div role="radiogroup" aria-label={r.description} className="inline-flex rounded-full border border-line bg-night p-0.5">
                  {CHOICES.map((c) => {
                    const disabled = c.value === "grant" && !r.grantable && r.override !== "grant";
                    return (
                      <label
                        key={c.value}
                        className={cn(
                          "cursor-pointer rounded-full px-3 py-1 text-xs text-muted transition-colors has-[:checked]:bg-raised has-[:checked]:text-frost",
                          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-mint",
                          c.value === "deny" && "has-[:checked]:text-danger",
                          c.value === "grant" && "has-[:checked]:text-leaf",
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                        title={disabled ? "You can only allow permissions you have yourself" : undefined}
                      >
                        <input type="radio" name={`perm.${r.key}`} value={c.value} defaultChecked={r.override === c.value} disabled={disabled} className="sr-only" />
                        {c.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
        </fieldset>
      ))}
      <SaveBar state={state} pending={pending} label="Save permissions" savedMessage="Permissions saved. They apply on the admin's next click." />
    </form>
  );
}
