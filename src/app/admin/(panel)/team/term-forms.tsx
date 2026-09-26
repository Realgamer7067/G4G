"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { deleteTeamTermAction, saveTeamTermAction, setCurrentTeamTermAction } from "@/server/actions/team-terms";

const ROW_GRID = "grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] sm:items-start";

export function NewTeamTermForm() {
  const { state, pending, onSubmit } = useFormAction(saveTeamTermAction);
  const formRef = useRef<HTMLFormElement>(null);
  const err = (p: string) => fieldErrorFor(state, p);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className={ROW_GRID}>
      <div className="grid gap-1">
        <Input name="label" placeholder="e.g. 2026-27" maxLength={40} aria-label="Term label" required />
        <FormMessage>{err("label")}</FormMessage>
      </div>
      <div className="grid gap-1">
        <Input name="startYear" type="number" placeholder="2026" min={2000} max={2100} aria-label="Start year" required />
        <FormMessage>{err("startYear")}</FormMessage>
      </div>
      <label className="flex h-10 items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="isPublished" defaultChecked className="size-3.5 accent-leaf" /> Published
      </label>
      <Button type="submit" disabled={pending}>
        Add term
      </Button>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}

export type TeamTermRowValues = {
  id: string;
  label: string;
  startYear: number;
  isCurrent: boolean;
  isPublished: boolean;
  memberCount: number;
};

export function TeamTermRow({ term }: { term: TeamTermRowValues }) {
  const { state, pending, onSubmit } = useFormAction(saveTeamTermAction);
  const err = (p: string) => fieldErrorFor(state, p);
  const current = useFormAction(setCurrentTeamTermAction);
  const del = useFormAction(deleteTeamTermAction);

  return (
    <li className="grid gap-2 rounded-xl border border-line bg-surface p-3">
      <form onSubmit={onSubmit} className={ROW_GRID}>
        <input type="hidden" name="id" value={term.id} />
        <div className="grid gap-1">
          <Input name="label" defaultValue={term.label} maxLength={40} aria-label={`Label for ${term.label}`} required />
          <FormMessage>{err("label")}</FormMessage>
        </div>
        <div className="grid gap-1">
          <Input name="startYear" type="number" defaultValue={term.startYear} min={2000} max={2100} aria-label={`Start year for ${term.label}`} required />
          <FormMessage>{err("startYear")}</FormMessage>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="isPublished" defaultChecked={term.isPublished} className="size-3.5 accent-leaf" /> Published
        </label>
        <Button type="submit" variant="secondary" disabled={pending}>
          Save
        </Button>
        {state && !state.ok && !state.fieldErrors && <FormMessage>{state.error}</FormMessage>}
        {state?.ok && <FormMessage tone="success">Saved.</FormMessage>}
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/admin/team/${term.id}`} className="inline-flex items-center gap-1 text-leaf hover:underline">
          {term.memberCount} member{term.memberCount === 1 ? "" : "s"} <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        {term.isCurrent ? (
          <span className="rounded-full border border-leaf/40 bg-leaf/10 px-2.5 py-1 text-xs text-leaf">Current term</span>
        ) : (
          <>
            <form onSubmit={current.onSubmit}>
              <input type="hidden" name="id" value={term.id} />
              <Button type="submit" variant="ghost" size="sm" disabled={current.pending}>
                Set as current
              </Button>
            </form>
            <form onSubmit={del.onSubmit} className="inline-flex items-center gap-2">
              <input type="hidden" name="id" value={term.id} />
              <ConfirmSubmit label="Delete" confirmLabel={`Delete ${term.label}`} variant="ghost" size="sm" disabled={del.pending} />
            </form>
          </>
        )}
      </div>
      {current.state && !current.state.ok && <FormMessage>{current.state.error}</FormMessage>}
      {del.state && !del.state.ok && <FormMessage>{del.state.error}</FormMessage>}
    </li>
  );
}
