import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { canAssignRole, permissionsBeyondActor } from "@/lib/admin/policies";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ALL_PERMISSION_KEYS } from "@/lib/rbac/permissions";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/roles";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/time";
import { revokeInviteAction } from "@/server/actions/admins";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Admins" };

export default async function UsersPage() {
  const me = await requirePagePermission("admins.manage");
  const [admins, invites, roles] = await Promise.all([
    db.adminUser.findMany({ include: { role: true }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db.invite.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { role: true, invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.role.findMany({ include: { permissions: true }, orderBy: { name: "asc" } }),
  ]);
  const assignable = roles.filter(
    (r) =>
      canAssignRole(me, r.key) &&
      permissionsBeyondActor(me, r.key === SUPER_ADMIN_ROLE_KEY ? ALL_PERMISSION_KEYS : r.permissions.map((p) => p.permissionKey)).length === 0,
  );

  return (
    <div className="grid max-w-5xl gap-8">
      <PageHeader eyebrow="Administration" title="Admins" description="Everyone who can sign in to this panel. New admins join through a single-use invite link." />

      <Panel title="Invite an admin" description="You can only invite people into roles whose permissions you have yourself.">
        <InviteForm roles={assignable.map((r) => ({ id: r.id, name: r.name }))} />
      </Panel>

      {invites.length > 0 && (
        <Panel title="Pending invites">
          <ul className="divide-y divide-line">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-medium">{inv.email}</span>
                  <span className="text-xs text-muted">
                    {inv.role.name} · invited by {inv.invitedBy?.name ?? "a former admin"} · expires {timeAgo(inv.expiresAt)}
                  </span>
                </div>
                <form action={revokeInviteAction}>
                  <input type="hidden" name="inviteId" value={inv.id} />
                  <ConfirmSubmit label="Revoke" confirmLabel="Revoke invite" variant="ghost" />
                </form>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={`Admins (${admins.length})`}>
        <ul className="divide-y divide-line">
          {admins.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/users/${a.id}`} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-raised/60">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-raised font-display font-semibold text-leaf">
                  {a.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {a.name}
                    {a.id === me.id && <span className="ml-2 text-xs text-muted">(you)</span>}
                  </span>
                  <span className="truncate text-xs text-muted">{a.email}</span>
                </span>
                <span className="hidden text-sm text-muted sm:block">{a.role.name}</span>
                <span className="hidden w-32 text-right text-xs text-muted md:block">{a.lastLoginAt ? `Active ${timeAgo(a.lastLoginAt)}` : "Never signed in"}</span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    a.isActive ? "border-leaf/30 bg-leaf/10 text-leaf" : "border-line text-muted",
                  )}
                >
                  {a.isActive ? "Active" : "Deactivated"}
                </span>
                <ChevronRight aria-hidden="true" className="size-4 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
