import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { permissionsBeyondActor } from "@/lib/admin/policies";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/roles";
import { DeleteRoleForm, RoleEditor } from "../role-form";

export const metadata: Metadata = { title: "Edit role" };

export default async function RolePage({ params, searchParams }: PageProps<"/admin/roles/[id]">) {
  const me = await requirePagePermission("roles.manage");
  const { id } = await params;
  const { created } = await searchParams;
  const role = await db.role.findUnique({
    where: { id },
    include: { permissions: true, users: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
  });
  if (!role) notFound();
  const ownRole = role.id === me.roleId && me.roleKey !== SUPER_ADMIN_ROLE_KEY;

  return (
    <div className="grid max-w-4xl gap-8">
      <Link href="/admin/roles" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All roles
      </Link>
      <PageHeader eyebrow="Role" title={role.name} description={role.description || undefined} />
      {created && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Role created. Assign it to admins from their admin page or when you invite them.
        </p>
      )}

      {role.isSystem ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
          Super Admin is built in: it always has every permission and can&apos;t be edited or deleted.
        </p>
      ) : ownRole ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">This is your own role. Ask a super admin to change it.</p>
      ) : (
        <RoleEditor
          role={{ id: role.id, name: role.name, description: role.description, permissions: role.permissions.map((p) => p.permissionKey) }}
          options={PERMISSIONS.map((p) => ({ key: p.key, group: p.group, description: p.description, grantable: permissionsBeyondActor(me, [p.key]).length === 0 }))}
        />
      )}

      <Panel title={`Members (${role.users.length})`}>
        {role.users.length === 0 ? (
          <p className="text-sm text-muted">No one has this role yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {role.users.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="inline-flex rounded-full border border-line px-3 py-1 text-sm hover:border-leaf/40">
                  {u.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {!role.isSystem && !ownRole && (
        <Panel title="Delete role" description="Only possible once no admin or pending invite uses it.">
          <DeleteRoleForm roleId={role.id} />
        </Panel>
      )}
    </div>
  );
}
