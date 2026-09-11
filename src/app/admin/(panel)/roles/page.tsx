import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage() {
  await requirePagePermission("roles.manage");
  const roles = await db.role.findMany({
    include: { _count: { select: { users: true, permissions: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader
        eyebrow="Administration"
        title="Roles"
        description="A role is a bundle of permissions. Give each admin a role, then fine-tune individuals on their admin page."
        actions={
          <Link href="/admin/roles/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            <Plus className="size-4" aria-hidden="true" /> New role
          </Link>
        }
      />
      <ul className="grid gap-3">
        {roles.map((r) => (
          <li key={r.id}>
            <Link
              href={`/admin/roles/${r.id}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-leaf/30 sm:p-5"
            >
              <div className="grid min-w-0 flex-1 gap-1">
                <span className="flex items-center gap-2 font-semibold">
                  {r.name}
                  {r.isSystem && <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[11px] font-normal text-amber">System</span>}
                </span>
                {r.description && <span className="text-sm text-muted">{r.description}</span>}
              </div>
              <span className="hidden text-right text-xs text-muted sm:grid">
                <span>
                  {r._count.users} member{r._count.users === 1 ? "" : "s"}
                </span>
                <span>{r.isSystem ? "Every permission" : `${r._count.permissions} permission${r._count.permissions === 1 ? "" : "s"}`}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
