"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { useFormAction } from "@/components/admin/form-state";
import { Picture } from "@/components/media/picture";
import { FormMessage } from "@/components/ui/form-message";
import type { TeamMemberDTO } from "@/lib/team/schema";
import { deleteTeamMemberAction, moveTeamMemberAction } from "@/server/actions/team-members";

const ARROW = "rounded p-1.5 text-muted hover:text-frost disabled:opacity-30";

export function MemberGroupList({ termId, members }: { termId: string; members: TeamMemberDTO[] }) {
  const move = useFormAction(moveTeamMemberAction);
  const del = useFormAction(deleteTeamMemberAction);

  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {members.map((m, i) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface p-3">
            <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-tile">
                {m.photo && <Picture image={m.photo} sizes="40px" alt="" imgClassName="size-full object-cover" />}
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex min-w-0 items-center gap-1.5 font-medium">
                  <span className="truncate">{m.name}</span>
                  {m.featured && <Star role="img" aria-label="Featured on homepage" className="size-3.5 shrink-0 text-amber" fill="currentColor" />}
                </span>
                <span className="truncate text-sm text-muted">{m.title}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <form onSubmit={move.onSubmit}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="direction" value="-1" />
                <button type="submit" aria-label={`Move ${m.name} up`} disabled={i === 0 || move.pending} className={ARROW}>
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
              </form>
              <form onSubmit={move.onSubmit}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="direction" value="1" />
                <button type="submit" aria-label={`Move ${m.name} down`} disabled={i === members.length - 1 || move.pending} className={ARROW}>
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
              </form>
              <Link href={`/admin/team/${termId}/${m.id}`} className="px-2 text-sm text-leaf hover:underline">
                Edit
              </Link>
              <form onSubmit={del.onSubmit}>
                <input type="hidden" name="id" value={m.id} />
                <ConfirmSubmit label="Delete" confirmLabel={`Delete ${m.name}`} variant="ghost" size="sm" disabled={del.pending} />
              </form>
            </div>
          </li>
        ))}
      </ul>
      {move.state && !move.state.ok && <FormMessage>{move.state.error}</FormMessage>}
      {del.state && !del.state.ok && <FormMessage>{del.state.error}</FormMessage>}
    </div>
  );
}
