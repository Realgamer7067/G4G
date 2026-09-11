"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/categories";

export function CategoryForm({ id, name, eventCount }: { id?: string; name?: string; eventCount?: number }) {
  const { state, pending, onSubmit } = useFormAction(saveCategoryAction);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <form onSubmit={onSubmit} className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        {id && <input type="hidden" name="id" value={id} />}
        <div className="grid min-w-48 flex-1 gap-1">
          <Input name="name" defaultValue={name} maxLength={40} aria-label={id ? `Rename ${name}` : "New category name"} placeholder={id ? undefined : "e.g. Workshop"} required />
          <FormMessage>{fieldErrorFor(state, "name") ?? (state && !state.ok && !state.fieldErrors ? state.error : undefined)}</FormMessage>
        </div>
        <Button type="submit" variant={id ? "secondary" : "primary"} size="sm" disabled={pending} className="mt-1">
          {id ? "Rename" : "Add category"}
        </Button>
        {state?.ok && <FormMessage tone="success">Saved.</FormMessage>}
      </form>
      {id && (
        <form action={deleteCategoryAction} className="mt-1 flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit label="Delete" confirmLabel={eventCount ? `Delete (${eventCount} event${eventCount === 1 ? "" : "s"} lose it)` : "Delete"} variant="ghost" />
        </form>
      )}
    </div>
  );
}
