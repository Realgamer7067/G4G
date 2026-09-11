import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { QUICK_ACTIONS } from "@/components/admin/quick-actions";
import { StatusPill } from "@/components/events/status-pill";
import { describeAction } from "@/lib/audit-labels";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { loadPageSettings } from "@/lib/data/pages";
import { loadSiteSettings } from "@/lib/data/site";
import { formatEventWhen } from "@/lib/events/format";
import { deriveEventStatus } from "@/lib/events/status";
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

function Card({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  const id = `card-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {href && (
          <Link href={href} className="text-sm text-leaf hover:underline">
            {linkLabel ?? "View all"}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard.view");
  const canLogs = can(user, "logs.view");
  const canAdmins = can(user, "admins.manage");
  const canEvents = can(user, "events.edit") || can(user, "events.publish") || can(user, "events.create");
  const now = new Date();

  const [activeAdmins, pendingInvites, pages, recent, upcoming, drafts, { timezone }] = await Promise.all([
    db.adminUser.count({ where: { isActive: true } }),
    canAdmins ? db.invite.count({ where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } }) : Promise.resolve(0),
    loadPageSettings(),
    canLogs ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }) : Promise.resolve([]),
    canEvents
      ? db.event.findMany({ where: { lifecycle: { in: ["PUBLISHED", "CANCELLED"] }, endAt: { gte: now } }, orderBy: { startAt: "asc" }, take: 5 })
      : Promise.resolve([]),
    canEvents ? db.event.findMany({ where: { lifecycle: "DRAFT" }, orderBy: { updatedAt: "desc" }, take: 5 }) : Promise.resolve([]),
    loadSiteSettings(),
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
        {canEvents ? (
          <Stat label="Upcoming events" value={upcoming.length} href="/admin/events" />
        ) : (
          <Stat label="Active admins" value={activeAdmins} href={canAdmins ? "/admin/users" : undefined} />
        )}
        {canEvents ? <Stat label="Draft events" value={drafts.length} href="/admin/events?view=drafts" /> : canAdmins && <Stat label="Pending invites" value={pendingInvites} href="/admin/users" />}
        <Stat label={`of ${pages.length} pages live`} value={livePages} href={can(user, "pages.manage") ? "/admin/pages" : undefined} />
      </section>

      {canEvents && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Upcoming events" href="/admin/events">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">Nothing scheduled. {can(user, "events.create") && <Link href="/admin/events/new" className="text-leaf hover:underline">Create an event</Link>}</p>
            ) : (
              <ul className="grid gap-3">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/events/${e.id}`} className="grid gap-1 rounded-xl p-2 -m-2 hover:bg-raised/50">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{e.title}</span>
                        <StatusPill status={deriveEventStatus(e, null, now)} />
                      </span>
                      <span className="text-xs text-muted">{formatEventWhen(e.startAt, e.endAt, timezone).full}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Drafts" href="/admin/events?view=drafts">
            {drafts.length === 0 ? (
              <p className="text-sm text-muted">No drafts waiting.</p>
            ) : (
              <ul className="grid gap-3">
                {drafts.map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/events/${e.id}`} className="grid gap-0.5 rounded-xl p-2 -m-2 hover:bg-raised/50">
                      <span className="font-medium">{e.title}</span>
                      <span className="text-xs text-muted">Edited {timeAgo(e.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {canLogs && (
          <Card title="Recent activity" href="/admin/audit">
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
          </Card>
        )}
        <Card title="Your access">
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
        </Card>
      </div>
    </div>
  );
}
