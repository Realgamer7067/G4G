"use client";

import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { deleteDomainAction, moveDomainAction, saveDomainAction } from "@/server/actions/team-domains";

export function DomainForm({
  id,
  name,
  memberCount,
  isFirst,
  isLast,
}: {
  id?: string;
  name?: string;
  memberCount?: number;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction(saveDomainAction);
  const move = useFormAction(moveDomainAction);
  const del = useFormAction(deleteDomainAction);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!id && state?.ok) formRef.current?.reset();
  }, [id, state]);

  return (
    <div className="flex flex-wrap items-start gap-2">
      {id && (
        <span className="mt-1 flex flex-col">
          <form onSubmit={move.onSubmit}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="direction" value="-1" />
            <button type="submit" aria-label={`Move ${name} up`} disabled={isFirst || move.pending} className="rounded p-1 text-muted hover:text-frost disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
          </form>
          <form onSubmit={move.onSubmit}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="direction" value="1" />
            <button type="submit" aria-label={`Move ${name} down`} disabled={isLast || move.pending} className="rounded p-1 text-muted hover:text-frost disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
          </form>
        </span>
      )}
      <form ref={formRef} onSubmit={onSubmit} className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        {id && <input type="hidden" name="id" value={id} />}
        <div className="grid min-w-40 flex-1 gap-1">
          <Input name="name" defaultValue={name} maxLength={40} aria-label={id ? `Rename ${name}` : "New domain name"} placeholder={id ? undefined : "e.g. Development"} required />
          <FormMessage>{fieldErrorFor(state, "name") ?? (state && !state.ok && !state.fieldErrors ? state.error : undefined)}</FormMessage>
        </div>
        <Button type="submit" variant={id ? "secondary" : "primary"} disabled={pending}>
          {id ? "Rename" : "Add domain"}
        </Button>
        {state?.ok && <FormMessage tone="success">Saved.</FormMessage>}
      </form>
      {id && (
        <form onSubmit={del.onSubmit} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit label="Delete" confirmLabel={memberCount ? `Delete (${memberCount} member${memberCount === 1 ? "" : "s"} lose it)` : "Delete"} variant="ghost" disabled={del.pending} />
          {move.state && !move.state.ok && <FormMessage>{move.state.error}</FormMessage>}
          {del.state && !del.state.ok && <FormMessage>{del.state.error}</FormMessage>}
        </form>
      )}
    </div>
  );
}
