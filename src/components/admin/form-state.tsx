"use client";

import { startTransition, useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import type { ActionResult } from "@/lib/actions";

type Action<T> = (prev: ActionResult<T> | undefined, formData: FormData) => Promise<ActionResult<T>>;

/**
 * Runs a server action from onSubmit instead of the form `action` prop. React resets forms after
 * `action`-prop submissions even when validation fails, which would throw away what the admin typed.
 */
export function useFormAction<T>(action: Action<T>) {
  const [state, dispatch, pending] = useActionState<ActionResult<T> | undefined, FormData>(action, undefined);
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }
  return { state, pending, onSubmit };
}

export function fieldErrorFor(state: ActionResult<unknown> | undefined, path: string): string | undefined {
  return state && !state.ok ? state.fieldErrors?.[path]?.[0] : undefined;
}

/** All messages for fields under a prefix, e.g. every error inside a repeater. */
export function errorsUnder(state: ActionResult<unknown> | undefined, prefix: string): string[] {
  if (!state || state.ok || !state.fieldErrors) return [];
  return Object.entries(state.fieldErrors)
    .filter(([key]) => key === prefix || key.startsWith(`${prefix}.`))
    .flatMap(([, messages]) => messages ?? []);
}

/** Sticky footer with the submit button and the result of the last save. */
export function SaveBar({
  state,
  pending,
  label = "Save changes",
  savedMessage = "Saved.",
}: {
  state: ActionResult<unknown> | undefined;
  pending: boolean;
  label?: string;
  savedMessage?: string;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-night/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {pending ? "Saving…" : label}
      </Button>
      {!pending && state?.ok && <FormMessage tone="success">{savedMessage}</FormMessage>}
      {!pending && state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </div>
  );
}
