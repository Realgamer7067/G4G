"use client";

import { Copy } from "lucide-react";
import { useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { copyTeamMembersFromPreviousTermAction } from "@/server/actions/team-members";

export function CopyTermForm({ termId }: { termId: string }) {
  const { state, pending, onSubmit } = useFormAction(copyTeamMembersFromPreviousTermAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-2 rounded-2xl border border-dashed border-line p-4">
      <input type="hidden" name="termId" value={termId} />
      <p className="text-sm text-muted">Start from the previous term&apos;s roster instead of adding everyone by hand.</p>
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="w-fit">
        <Copy className="size-4" aria-hidden="true" /> Copy members from previous term
      </Button>
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
