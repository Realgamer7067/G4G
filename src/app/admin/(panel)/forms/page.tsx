import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { can, requireAnyPagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils/cn";
import { timeAgo } from "@/lib/utils/time";
import { FORM_STATUS_META, formStatus } from "./form-status";

export const metadata: Metadata = { title: "Forms" };

export default async function FormsPage({ searchParams }: PageProps<"/admin/forms">) {
  const me = await requireAnyPagePermission(["forms.create", "forms.edit", "forms.responses.view", "forms.delete"]);
  const sp = await searchParams;
  const forms = await db.form.findMany({
    include: { _count: { select: { responses: true } }, events: { select: { title: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const openHref = (id: string) => (can(me, "forms.edit") ? `/admin/forms/${id}/build` : `/admin/forms/${id}/responses`);

  return (
    <div className="grid max-w-5xl gap-8">
      <PageHeader
        eyebrow="Content"
        title="Forms"
        description="Registration forms, recruitment drives and surveys, with conditional questions and multiple pages."
        actions={
          can(me, "forms.create") ? (
            <Link href="/admin/forms/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
              <Plus className="size-4" aria-hidden="true" /> New form
            </Link>
          ) : undefined
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Form deleted.
        </p>
      )}
      {forms.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">No forms yet.</p>
          {can(me, "forms.create") && (
            <Link href="/admin/forms/new" className="text-sm text-leaf hover:underline">
              Create your first form
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {forms.map((f) => {
            const status = FORM_STATUS_META[formStatus(f)];
            return (
              <li key={f.id}>
                <Link href={openHref(f.id)} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-leaf/30">
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate font-semibold">{f.name}</span>
                    <span className="truncate text-sm text-muted">
                      {f.visibility === "EVENT_ONLY" ? "Event registration" : `/forms/${f.slug}`}
                      {f.events.length > 0 && ` · used by ${f.events.map((e) => e.title).join(", ")}`}
                    </span>
                  </span>
                  <span className="hidden text-right text-sm sm:grid">
                    <span className="font-semibold tabular-nums">{f._count.responses}</span>
                    <span className="text-xs text-muted">responses</span>
                  </span>
                  <span className="hidden w-28 text-right text-xs text-muted md:block">Edited {timeAgo(f.updatedAt)}</span>
                  <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs", status.className)}>{status.label}</span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
