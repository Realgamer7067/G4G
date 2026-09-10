import { requirePagePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard.view");
  const groups = new Map<string, string[]>();
  for (const p of PERMISSIONS) {
    if (!user.permissions.has(p.key)) continue;
    groups.set(p.group, [...(groups.get(p.group) ?? []), p.description]);
  }
  return (
    <div className="grid max-w-4xl gap-8">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">Dashboard</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="text-muted">
          You&apos;re signed in as <span className="text-frost">{user.roleName}</span>.
        </p>
      </header>
      <section aria-labelledby="access" className="rounded-2xl border border-line bg-surface p-6">
        <h2 id="access" className="font-display text-lg font-semibold">
          Your access
        </h2>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          {[...groups].map(([group, items]) => (
            <div key={group} className="grid content-start gap-1.5">
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
  );
}
