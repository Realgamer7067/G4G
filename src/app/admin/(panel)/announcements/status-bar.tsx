"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { setAnnouncementStatusAction } from "@/server/actions/announcements";

export function AnnouncementStatusBar({ id, status, publicUrl }: { id: string; status: "DRAFT" | "PUBLISHED"; publicUrl: string | null }) {
  const { state, pending, onSubmit } = useFormAction(setAnnouncementStatusAction);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <form onSubmit={onSubmit} className="grid gap-1">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="to" value={status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
        {status === "PUBLISHED" ? (
          <ConfirmSubmit label="Unpublish" confirmLabel="Unpublish" variant="secondary" disabled={pending} />
        ) : (
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Working…" : "Publish"}
          </Button>
        )}
        {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
      </form>
      {publicUrl && (
        <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] text-muted hover:text-frost">
          View on site
        </a>
      )}
    </div>
  );
}
