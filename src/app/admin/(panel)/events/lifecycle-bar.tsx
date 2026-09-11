"use client";

import { Copy, ExternalLink } from "lucide-react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TRANSITION_COPY, type Lifecycle } from "@/lib/events/lifecycle";
import { deleteEventAction, duplicateEventAction, setEventLifecycleAction } from "@/server/actions/events";

function Transition({ id, from, to }: { id: string; from: Lifecycle; to: Lifecycle }) {
  const { state, pending, onSubmit } = useFormAction(setEventLifecycleAction);
  const copy = TRANSITION_COPY[`${from}>${to}`];
  const primary = to === "PUBLISHED";
  return (
    <form onSubmit={onSubmit} className="grid gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      {primary ? (
        <Button type="submit" size="sm" disabled={pending} title={copy.hint}>
          {pending ? "Working…" : copy.label}
        </Button>
      ) : (
        <ConfirmSubmit label={copy.label} confirmLabel={copy.confirm} variant="secondary" disabled={pending} />
      )}
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}

export function LifecycleBar({
  id,
  lifecycle,
  transitions,
  publicUrl,
  can,
}: {
  id: string;
  lifecycle: Lifecycle;
  transitions: Lifecycle[];
  publicUrl: string | null;
  can: { publish: boolean; create: boolean; delete: boolean };
}) {
  const duplicate = useFormAction(duplicateEventAction);
  const remove = useFormAction(deleteEventAction);
  return (
    <div className="flex flex-wrap items-start gap-2">
      {can.publish && transitions.map((to) => <Transition key={to} id={id} from={lifecycle} to={to} />)}
      {publicUrl && (
        <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] text-muted hover:text-frost">
          View on site <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
      {can.create && (
        <form onSubmit={duplicate.onSubmit}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" variant="ghost" size="sm" disabled={duplicate.pending}>
            <Copy className="size-3.5" aria-hidden="true" /> Duplicate
          </Button>
        </form>
      )}
      {can.delete && lifecycle !== "PUBLISHED" && (
        <form onSubmit={remove.onSubmit} className="grid gap-1">
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit label="Delete" confirmLabel="Delete permanently" variant="ghost" disabled={remove.pending} />
          {remove.state && !remove.state.ok && <FormMessage>{remove.state.error}</FormMessage>}
        </form>
      )}
      {duplicate.state && !duplicate.state.ok && <FormMessage>{duplicate.state.error}</FormMessage>}
    </div>
  );
}
