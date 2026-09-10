import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4">
      <div className="grid max-w-md gap-3 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-amber">403</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">You don&apos;t have access to this page</h1>
        <p className="text-muted">Ask a super admin to add the permission to your role if you need it.</p>
        <Link href="/admin" className="justify-self-center text-sm text-leaf underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
