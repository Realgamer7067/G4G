import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { canAssignRole, permissionsBeyondActor } from "@/lib/admin/policies";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ALL_PERMISSION_KEYS, PERMISSIONS } from "@/lib/rbac/permissions";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/roles";
import { timeAgo } from "@/lib/utils/time";
import { OverridesForm, RoleForm, StatusForm, type OverrideRow } from "./admin-forms";

export const metadata: Metadata = { title: "Manage admin" };

export default async function AdminDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requirePagePermission("admins.manage");
  const { id } = await params;
  const admin = await db.adminUser.findUnique({
    where: { id },
    include: { role: { include: { permissions: true } }, permissionOverrides: true },
  });
  if (!admin) notFound();

  const roles = await db.role.findMany({ include: { permissions: true }, orderBy: { name: "asc" } });
  const isSelf = admin.id === me.id;
  const targetIsSuper = admin.role.key === SUPER_ADMIN_ROLE_KEY;
  const locked = isSelf || (targetIsSuper && me.roleKey !== SUPER_ADMIN_ROLE_KEY);
  const assignable = roles.filter(
    (r) =>
      r.id === admin.roleId ||
      (canAssignRole(me, r.key) &&
        permissionsBeyondActor(me, r.key === SUPER_ADMIN_ROLE_KEY ? ALL_PERMISSION_KEYS : r.permissions.map((p) => p.permissionKey)).length === 0),
  );
  const rolePerms = new Set(admin.role.permissions.map((p) => p.permissionKey));
  const overrides = new Map(admin.permissionOverrides.map((o) => [o.permissionKey, o.effect]));
  const rows: OverrideRow[] = PERMISSIONS.map((p) => ({
    key: p.key,
    description: p.description,
    group: p.group,
    fromRole: rolePerms.has(p.key),
    override: overrides.get(p.key) === "GRANT" ? "grant" : overrides.get(p.key) === "DENY" ? "deny" : "inherit",
    grantable: permissionsBeyondActor(me, [p.key]).length === 0,
  }));

  return (
    <div className="grid max-w-4xl gap-8">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All admins
      </Link>
      <PageHeader
        eyebrow="Admin"
        title={admin.name}
        description={
          <>
            {admin.email} · {admin.role.name} · {admin.isActive ? "Active" : "Deactivated"} ·{" "}
            {admin.lastLoginAt ? `last signed in ${timeAgo(admin.lastLoginAt)}` : "never signed in"}
          </>
        }
      />

      {locked ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          {isSelf
            ? "This is your own account. Another admin has to change your role or permissions."
            : "Only a super admin can change another super admin."}
        </p>
      ) : (
        <>
          <Panel title="Role" description="Changing the role takes effect on the admin's next click.">
            <RoleForm userId={admin.id} roleId={admin.roleId} roles={assignable.map((r) => ({ id: r.id, name: r.name }))} />
          </Panel>
          <Panel
            title="Individual permissions"
            description={
              targetIsSuper
                ? "Super admins always have every permission."
                : "Allow or block single permissions for this person without changing their role. “Role” follows whatever the role allows."
            }
          >
            {!targetIsSuper && <OverridesForm userId={admin.id} rows={rows} />}
          </Panel>
          <Panel title="Account status" description="Deactivated admins can't sign in and are signed out of every device immediately.">
            <StatusForm userId={admin.id} isActive={admin.isActive} />
          </Panel>
        </>
      )}
    </div>
  );
}
