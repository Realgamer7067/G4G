"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { useFormAction } from "@/components/admin/form-state";
import { FormMessage } from "@/components/ui/form-message";
import { deleteResponsesAction } from "@/server/actions/forms";

export function DeleteResponse({ formId, responseId }: { formId: string; responseId: string }) {
  const router = useRouter();
  const { state, pending, onSubmit } = useFormAction(deleteResponsesAction);
  useEffect(() => {
    if (state?.ok) router.push(`/admin/forms/${formId}/responses`);
  }, [state, router, formId]);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="formId" value={formId} />
      <input type="hidden" name="ids" value={responseId} />
      <ConfirmSubmit label="Delete response" confirmLabel="Delete permanently" disabled={pending} />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
