import type { Metadata } from "next";
import Link from "next/link";
import { LogoTile } from "@/components/brand/logo-tile";
import { Rings } from "@/components/site/rings";
import { INVALID_INVITE, findUsableInvite } from "@/server/invites";
import { AcceptInviteForm } from "./accept-form";

export const metadata: Metadata = { title: "Accept invite", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitePage({ params }: PageProps<"/admin/invite/[token]">) {
  const { token } = await params;
  const invite = await findUsableInvite(token);
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <Rings className="pointer-events-none absolute -right-40 top-1/2 -z-10 size-[680px] -translate-y-1/2 opacity-40" />
      <section className="w-full max-w-sm rounded-3xl border border-line bg-surface/90 p-8 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.8)] backdrop-blur">
        <div className="mb-8 grid justify-items-start gap-5">
          <LogoTile size="md" priority />
          <div className="grid gap-1">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">Chapter admin</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">{invite ? "Join the admin team" : "Invite unavailable"}</h1>
            {invite && (
              <p className="text-sm text-muted">
                You&apos;ve been invited as <span className="text-frost">{invite.role.name}</span>.
              </p>
            )}
          </div>
        </div>
        {invite ? (
          <AcceptInviteForm token={token} email={invite.email} />
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-muted">{INVALID_INVITE}</p>
            <Link href="/admin/login" className="text-sm text-leaf hover:underline">
              Already have an account? Sign in
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
