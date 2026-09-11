import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { permissionsBeyondActor } from "@/lib/admin/policies";
import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { RoleEditor } from "../role-form";

export const metadata: Metadata = { title: "New role" };

export default async function NewRolePage() {
  const me = await requirePagePermission("roles.manage");
  return (
    <div className="grid max-w-4xl gap-8">
      <Link href="/admin/roles" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All roles
      </Link>
      <PageHeader eyebrow="Administration" title="New role" />
      <RoleEditor
        role={null}
        options={PERMISSIONS.map((p) => ({ key: p.key, group: p.group, description: p.description, grantable: permissionsBeyondActor(me, [p.key]).length === 0 }))}
      />
    </div>
  );
}
