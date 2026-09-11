import { LogoTile } from "@/components/brand/logo-tile";
import { Rings } from "@/components/site/rings";
import { getSiteSettings } from "@/lib/data/site";

// Interim homepage built from site settings. Replaced by the homepage editor's sections in phase 4.
export default async function HomePage() {
  const s = await getSiteSettings();
  return (
    <section className="relative isolate overflow-hidden">
      <Rings className="pointer-events-none absolute -right-48 top-1/2 -z-10 size-[760px] -translate-y-1/2 opacity-50" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-16 sm:px-6 md:grid-cols-[1.3fr_1fr] md:items-center md:pt-24 lg:px-8">
        <div className="grid gap-6">
          {s.universityName && <p className="font-mono text-xs uppercase tracking-[0.1em] text-leaf">{s.universityName}</p>}
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            {s.tagline || s.clubName}
          </h1>
          {s.description && <p className="max-w-xl text-lg text-muted">{s.description}</p>}
          {s.email && (
            <div className="flex flex-wrap gap-3">
              <a href={`mailto:${s.email}`} className="rounded-full bg-leaf px-5 py-3 font-semibold text-night">
                Get in touch
              </a>
            </div>
          )}
        </div>
        <div className="justify-self-center">
          <LogoTile size="lg" priority />
        </div>
      </div>
    </section>
  );
}
