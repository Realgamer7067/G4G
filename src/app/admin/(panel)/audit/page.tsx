import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AUDIT_PAGE_SIZE, auditQueryString, buildAuditWhere, parseAuditFilters } from "@/lib/audit-filters";
import { AUDIT_ACTION_FAMILIES, describeAction } from "@/lib/audit-labels";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { loadSiteSettings } from "@/lib/data/site";
import { formatInZone } from "@/lib/utils/timezone";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePagePermission("logs.view");
  const filters = parseAuditFilters(await searchParams);
  const { timezone } = await loadSiteSettings();
  const where = buildAuditWhere(filters, timezone);

  const [total, rows, actors, targets] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE }),
    db.adminUser.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.auditLog.findMany({ distinct: ["targetType"], select: { targetType: true }, orderBy: { targetType: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const hasFilters = Boolean(filters.q || filters.actor || filters.action || filters.target || filters.from || filters.to);

  return (
    <div className="grid max-w-6xl gap-8">
      <PageHeader eyebrow="Administration" title="Audit log" description={`Every change made in the admin panel. Times are in ${timezone.replaceAll("_", " ")}.`} />

      <form method="get" className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto_auto] lg:items-end">
        <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={filters.q} placeholder="Event name, email, admin…" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="actor">Admin</Label>
          <Select id="actor" name="actor" defaultValue={filters.actor}>
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="action">Activity</Label>
          <Select id="action" name="action" defaultValue={filters.action}>
            <option value="">All activity</option>
            {AUDIT_ACTION_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="target">Item type</Label>
          <Select id="target" name="target" defaultValue={filters.target}>
            <option value="">Any</option>
            {targets.map((t) => (
              <option key={t.targetType} value={t.targetType}>
                {t.targetType}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
          <div className="grid gap-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" type="date" defaultValue={filters.from} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" type="date" defaultValue={filters.to} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="h-10 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            Filter
          </button>
          {hasFilters && (
            <Link href="/admin/audit" className="inline-flex h-10 items-center rounded-full px-3 text-sm text-muted hover:text-frost">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-muted" aria-live="polite">
        {total === 0 ? "No matching activity." : `${total.toLocaleString("en-IN")} entr${total === 1 ? "y" : "ies"}`}
      </p>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-pine text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">When</th>
                <th scope="col" className="px-4 py-3 font-medium">Admin</th>
                <th scope="col" className="px-4 py-3 font-medium">What happened</th>
                <th scope="col" className="px-4 py-3 font-medium">Item</th>
                <th scope="col" className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {rows.map((r) => {
                const hasMeta = r.metadata && typeof r.metadata === "object" && Object.keys(r.metadata).length > 0;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">
                      {formatInZone(r.createdAt, timezone, { day: "2-digit", month: "short", year: "numeric" })}
                      <br />
                      {formatInZone(r.createdAt, timezone, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                    </td>
                    <td className="px-4 py-3">{r.actorName}</td>
                    <td className="px-4 py-3">
                      <span className={r.action === "auth.login_failed" ? "text-amber" : undefined}>{describeAction(r.action)}</span>
                      <span className="block font-mono text-[11px] text-muted">{r.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block max-w-56 truncate">{r.targetLabel || "—"}</span>
                      <span className="font-mono text-[11px] text-muted">{r.targetType}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {hasMeta || r.ip ? (
                        <details>
                          <summary className="cursor-pointer hover:text-frost">Show</summary>
                          <pre className="mt-2 max-w-72 overflow-x-auto whitespace-pre-wrap rounded-lg bg-night p-2 font-mono text-[11px]">
                            {JSON.stringify({ ...(hasMeta ? (r.metadata as object) : {}), ip: r.ip ?? undefined, device: r.userAgent ?? undefined }, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
          {filters.page > 1 ? (
            <Link href={`/admin/audit${auditQueryString(filters, filters.page - 1)}`} className="rounded-full border border-line px-4 py-2 hover:border-leaf/40">
              Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Page {filters.page} of {pages}
          </span>
          {filters.page < pages ? (
            <Link href={`/admin/audit${auditQueryString(filters, filters.page + 1)}`} className="rounded-full border border-line px-4 py-2 hover:border-leaf/40">
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
