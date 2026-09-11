import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { QUICK_ACTIONS } from "@/components/admin/quick-actions";
import { describeAction } from "@/lib/audit-labels";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { loadPageSettings } from "@/lib/data/pages";
import { isPageLive } from "@/lib/pages/registry";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { timeAgo } from "@/lib/utils/time";

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <>
      <span className="font-display text-3xl font-extrabold tabular-nums tracking-tight">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="grid gap-1 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-leaf/30">
      {body}
    </Link>
  ) : (
    <div className="grid gap-1 rounded-2xl border border-line bg-surface p-5">{body}</div>
  );
}

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard.view");
  const canLogs = can(user, "logs.view");
  const canAdmins = can(user, "admins.manage");

  const [activeAdmins, pendingInvites, pages, recent] = await Promise.all([
    db.adminUser.count({ where: { isActive: true } }),
    canAdmins ? db.invite.count({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }) : Promise.resolve(0),
    loadPageSettings(),
    canLogs ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
  ]);
  const livePages = pages.filter((p) => isPageLive(p)).length;
  const actions = QUICK_ACTIONS.filter((a) => can(user, a.permission));

  const groups = new Map<string, string[]>();
  for (const p of PERMISSIONS) {
    if (user.permissions.has(p.key)) groups.set(p.group, [...(groups.get(p.group) ?? []), p.description]);
  }

  return (
    <div className="grid max-w-6xl gap-8">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">Dashboard</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="text-muted">
          You&apos;re signed in as <span className="text-frost">{user.roleName}</span>.
        </p>
      </header>

      {actions.length > 0 && (
        <section aria-labelledby="quick" className="grid gap-3">
          <h2 id="quick" className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            Quick actions
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {actions.map(({ href, label, description, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group grid h-full gap-3 rounded-2xl border border-line bg-surface p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-leaf/40"
                >
                  <span className="flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-xl bg-leaf/10 text-leaf">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <ArrowUpRight className="size-4 text-muted transition-colors group-hover:text-leaf" aria-hidden="true" />
                  </span>
                  <span className="grid gap-0.5">
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs text-muted">{description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="At a glance" className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active admins" value={activeAdmins} href={canAdmins ? "/admin/users" : undefined} />
        {canAdmins && <Stat label="Pending invites" value={pendingInvites} href="/admin/users" />}
        <Stat label={`of ${pages.length} pages live`} value={livePages} href={can(user, "pages.manage") ? "/admin/pages" : undefined} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {canLogs && (
          <section aria-labelledby="activity" className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="activity" className="font-display text-lg font-semibold">
                Recent activity
              </h2>
              <Link href="/admin/audit" className="text-sm text-leaf hover:underline">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              <ol className="grid gap-3">
                {recent.map((r) => (
                  <li key={r.id} className="grid grid-cols-[auto_1fr] gap-3">
                    <span aria-hidden="true" className="mt-1.5 size-2 rounded-full bg-leaf/60" />
                    <span className="grid gap-0.5 text-sm">
                      <span>
                        <span className="font-medium">{r.actorName}</span> <span className="text-muted">{describeAction(r.action).toLowerCase()}</span>
                        {r.targetLabel && <span> · {r.targetLabel}</span>}
                      </span>
                      <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        <section aria-labelledby="access" className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 id="access" className="font-display text-lg font-semibold">
            Your access
          </h2>
          <dl className="grid gap-4">
            {[...groups].map(([group, items]) => (
              <div key={group} className="grid gap-1">
                <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{group}</dt>
                {items.map((d) => (
                  <dd key={d} className="text-sm">
                    {d}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
