import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoTile } from "@/components/brand/logo-tile";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getSession()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <svg
        aria-hidden="true"
        viewBox="0 0 620 620"
        className="pointer-events-none absolute -right-40 top-1/2 size-[680px] -translate-y-1/2 opacity-40"
      >
        <circle cx="230" cy="310" r="190" fill="none" stroke="#2F8D46" strokeOpacity=".45" strokeWidth="1.2" />
        <circle cx="390" cy="310" r="190" fill="none" stroke="#2F8D46" strokeOpacity=".45" strokeWidth="1.2" />
        <circle cx="230" cy="310" r="260" fill="none" stroke="#23392C" />
        <circle cx="390" cy="310" r="260" fill="none" stroke="#23392C" />
      </svg>
      <section className="relative w-full max-w-sm rounded-3xl border border-line bg-surface/90 p-8 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.8)] backdrop-blur">
        <div className="mb-8 grid justify-items-start gap-5">
          <LogoTile size="md" priority />
          <div className="grid gap-1">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">Chapter admin</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Sign in</h1>
          </div>
        </div>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </section>
    </main>
  );
}
