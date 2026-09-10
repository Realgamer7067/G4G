import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils/time";
import { revokeSessionAction, signOutOtherSessionsAction } from "@/server/actions/account";
import { PasswordForm, ProfileForm } from "./account-forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const sessions = await db.session.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" } });
  return (
    <div className="grid max-w-3xl gap-8">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">Account</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Your account</h1>
        <p className="text-muted">{user.email}</p>
      </header>

      <section aria-labelledby="profile" className="grid gap-4 rounded-2xl border border-line bg-surface p-6">
        <h2 id="profile" className="font-display text-lg font-semibold">
          Profile
        </h2>
        <ProfileForm name={user.name} />
      </section>

      <section aria-labelledby="password" className="grid gap-4 rounded-2xl border border-line bg-surface p-6">
        <div className="grid gap-1">
          <h2 id="password" className="font-display text-lg font-semibold">
            Password
          </h2>
          <p className="text-sm text-muted">Changing your password signs you out everywhere else.</p>
        </div>
        <PasswordForm />
      </section>

      <section aria-labelledby="sessions" className="grid gap-4 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sessions" className="font-display text-lg font-semibold">
            Where you&apos;re signed in
          </h2>
          {sessions.length > 1 && (
            <form action={signOutOtherSessionsAction}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out other sessions
              </Button>
            </form>
          )}
        </div>
        <ul className="divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-sm">{s.userAgent ?? "Unknown device"}</span>
                <span className="font-mono text-xs text-muted">
                  {s.ip ?? "unknown IP"} · active {timeAgo(s.lastSeenAt)}
                </span>
              </div>
              {s.id === user.sessionId ? (
                <span className="rounded-full border border-leaf/30 bg-leaf/10 px-2.5 py-1 text-xs text-leaf">This device</span>
              ) : (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Sign out
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
