import Link from "next/link";
import { LogoTile } from "@/components/brand/logo-tile";
import { Rings } from "@/components/site/rings";

export default function NotFound() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4">
      <Rings className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[720px] -translate-x-1/2 -translate-y-1/2 opacity-40" />
      <div className="grid max-w-md justify-items-center gap-5 text-center">
        <LogoTile size="md" />
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-leaf">404</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">This page isn&apos;t here</h1>
        <p className="text-muted">It may have moved, been switched off, or never existed.</p>
        <Link href="/" className="rounded-full bg-leaf px-5 py-2.5 font-semibold text-night">
          Back to home
        </Link>
      </div>
    </main>
  );
}
