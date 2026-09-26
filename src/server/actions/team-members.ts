// src/server/actions/team-members.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { formDataToObject } from "@/lib/forms-data";
import { getRequestMeta } from "@/lib/request-meta";
import { reorderIds, teamMemberSchema } from "@/lib/team/schema";
import { ensureImages, updateImageAlt } from "@/server/media/images";

export async function saveTeamMemberAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  let created = null as { termId: string; id: string } | null;
  const result = await runAction(async () => {
    const user = await requirePermission("team.manage");
    const input = teamMemberSchema.parse(formDataToObject(formData));
    const term = await db.teamTerm.findUnique({ where: { id: input.termId } });
    if (!term) throw new UserError("That term no longer exists.");
    const existing = input.id
      ? await db.teamMember.findUnique({ where: { id: input.id } })
      : null;
    if (input.id && !existing)
      throw new UserError("That member no longer exists.");
    if (input.domainId) {
      const domain = await db.domain.findUnique({
        where: { id: input.domainId },
      });
      if (!domain)
        throw new UserError("That domain no longer exists.", {
          domainId: ["That domain no longer exists."],
        });
    }
    const meta = await getRequestMeta();
    const saved = await db.$transaction(async (tx) => {
      await ensureImages(tx, [input.photoId]);
      const groupChanged =
        existing &&
        (existing.tier !== input.tier || existing.domainId !== input.domainId);
      const order =
        !existing || groupChanged
          ? await tx.teamMember.count({
              where: {
                termId: input.termId,
                tier: input.tier,
                domainId: input.domainId,
              },
            })
          : existing.order;
      const data = {
        termId: input.termId,
        name: input.name,
        photoId: input.photoId,
        title: input.title,
        tier: input.tier,
        domainId: input.domainId,
        bio: input.bio,
        links: input.links as Prisma.InputJsonValue,
        featured: input.featured,
        order,
      };
      const row = existing
        ? await tx.teamMember.update({ where: { id: existing.id }, data })
        : await tx.teamMember.create({ data });
      await updateImageAlt(tx, input.photoId, formData.get("photoIdAlt"));
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "team.member_updated" : "team.member_created",
        target: { type: "TeamMember", id: row.id, label: row.name },
        meta,
      });
      return row;
    });
    invalidate(TAGS.team);
    revalidatePath(`/admin/team/${input.termId}`);
    if (!existing) created = { termId: input.termId, id: saved.id };
    return null;
  });
  if (created)
    redirect(`/admin/team/${created.termId}/${created.id}?created=1`);
  return result;
}

export async function deleteTeamMemberAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  let termId = null as string | null;
  const result = await runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const member = await db.teamMember.findUnique({ where: { id } });
    if (!member) throw new UserError("That member no longer exists.");
    termId = member.termId;
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.teamMember.delete({ where: { id: member.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.member_deleted",
        target: { type: "TeamMember", id: member.id, label: member.name },
        meta,
      });
    });
    invalidate(TAGS.team);
    return null;
  });
  if (result.ok && termId) redirect(`/admin/team/${termId}?deleted=1`);
  return result;
}

export async function moveTeamMemberAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const direction = formData.get("direction") === "-1" ? -1 : 1;
    const member = await db.teamMember.findUnique({ where: { id } });
    if (!member) throw new UserError("That member no longer exists.");
    const group = await db.teamMember.findMany({
      where: {
        termId: member.termId,
        tier: member.tier,
        domainId: member.domainId,
      },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    const reordered = reorderIds(
      group.map((m) => m.id),
      id,
      direction,
    );
    if (!reordered)
      throw new UserError("That member can't move further in this list.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await Promise.all(
        reordered.map((memberId, index) =>
          tx.teamMember.update({
            where: { id: memberId },
            data: { order: index },
          }),
        ),
      );
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.member_moved",
        target: { type: "TeamMember", id: member.id, label: member.name },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath(`/admin/team/${member.termId}`);
    return null;
  });
}

export async function copyTeamMembersFromPreviousTermAction(
  _prev: ActionResult<{ copied: number }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ copied: number }>> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const termId = String(formData.get("termId") ?? "");
    const target = await db.teamTerm.findUnique({
      where: { id: termId },
      include: { _count: { select: { members: true } } },
    });
    if (!target) throw new UserError("That term no longer exists.");
    if (target._count.members > 0)
      throw new UserError(
        "This term already has members. Copying only works into an empty term.",
      );
    const previous = await db.teamTerm.findFirst({
      where: { startYear: { lt: target.startYear } },
      orderBy: { startYear: "desc" },
    });
    if (!previous) throw new UserError("There's no earlier term to copy from.");
    const source = await db.teamMember.findMany({
      where: { termId: previous.id },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    if (source.length === 0)
      throw new UserError("The previous term has no members to copy.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.teamMember.createMany({
        data: source.map((m) => ({
          termId: target.id,
          name: m.name,
          photoId: m.photoId,
          title: m.title,
          tier: m.tier,
          domainId: m.domainId,
          bio: m.bio,
          links: m.links as Prisma.InputJsonValue,
          featured: m.featured,
          order: m.order,
        })),
      });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.member_copied",
        target: { type: "TeamTerm", id: target.id, label: target.label },
        metadata: { fromTerm: previous.label, count: source.length },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath(`/admin/team/${target.id}`);
    return { copied: source.length };
  });
}
