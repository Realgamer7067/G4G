// src/server/actions/team-terms.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { isChecked } from "@/lib/forms-data";
import { getRequestMeta } from "@/lib/request-meta";
import { teamTermSchema } from "@/lib/team/schema";

const termFormSchema = teamTermSchema.extend({
  isPublished: z.unknown().optional().transform(isChecked),
});

export async function saveTeamTermAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const input = termFormSchema.parse(Object.fromEntries(formData));
    const existing = input.id
      ? await db.teamTerm.findUnique({ where: { id: input.id } })
      : null;
    if (input.id && !existing)
      throw new UserError("That term no longer exists.");
    const clash = await db.teamTerm.findUnique({
      where: { startYear: input.startYear },
    });
    if (clash && clash.id !== existing?.id) {
      throw new UserError("A term with that start year already exists.", {
        startYear: ["A term with that start year already exists."],
      });
    }
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      const isFirstTerm = !existing && (await tx.teamTerm.count()) === 0;
      const saved = existing
        ? await tx.teamTerm.update({
            where: { id: existing.id },
            data: {
              label: input.label,
              startYear: input.startYear,
              isPublished: input.isPublished,
            },
          })
        : await tx.teamTerm.create({
            data: {
              label: input.label,
              startYear: input.startYear,
              isPublished: input.isPublished,
              isCurrent: isFirstTerm,
            },
          });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "team.term_updated" : "team.term_created",
        target: { type: "TeamTerm", id: saved.id, label: saved.label },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}

export async function setCurrentTeamTermAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const term = await db.teamTerm.findUnique({ where: { id } });
    if (!term) throw new UserError("That term no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.teamTerm.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.teamTerm.update({ where: { id }, data: { isCurrent: true } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.term_current_changed",
        target: { type: "TeamTerm", id: term.id, label: term.label },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}

export async function deleteTeamTermAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const term = await db.teamTerm.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!term) throw new UserError("That term no longer exists.");
    if (term.isCurrent)
      throw new UserError(
        "You can't delete the current term. Set another term as current first.",
      );
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.teamTerm.delete({ where: { id: term.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.term_deleted",
        target: { type: "TeamTerm", id: term.id, label: term.label },
        metadata: { removedMembers: term._count.members },
        meta,
      });
    });
    invalidate(TAGS.team);
    return null;
  });
  if (result.ok) redirect("/admin/team?deleted=1");
  return result;
}
