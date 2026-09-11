import { ArrowUpRight } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { Rings } from "@/components/site/rings";
import { Spotlight } from "@/components/site/spotlight";
import { assertPageEnabled } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { getPublicSponsors } from "@/lib/data/sponsors";
import { SPONSOR_TIER_LABELS } from "@/lib/events/schema";
import { metadataForPage } from "@/lib/seo";

const ORDER = ["TITLE", "POWERED_BY", "TECHNOLOGY_PARTNER", "COMMUNITY_PARTNER", "PARTNER"] as const;
const GROUP_TITLES: Record<(typeof ORDER)[number], string> = {
  TITLE: "Title sponsors",
  POWERED_BY: "Powered by",
  TECHNOLOGY_PARTNER: "Technology partners",
  COMMUNITY_PARTNER: "Community partners",
  PARTNER: "Partners",
};

export async function generateMetadata() {
  return metadataForPage("SPONSORS", { title: "Sponsors & partners", description: "The organisations that make our events possible." });
}

export default async function SponsorsPage() {
  const page = await assertPageEnabled("SPONSORS");
  const [sponsors, site] = await Promise.all([getPublicSponsors(), getSiteSettings()]);
  const groups = ORDER.map((tier) => ({ tier, items: sponsors.filter((s) => s.tier === tier) })).filter((g) => g.items.length);

  return (
    <div className="relative isolate">
      <Rings className="pointer-events-none absolute -right-60 -top-40 -z-10 size-[720px] opacity-40" />
      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">The people backing our builders</h1>
        <p className="max-w-2xl text-lg text-muted">Every workshop, prize and pizza slice at our events is made possible by these organisations.</p>
      </section>

      <div className="mx-auto grid max-w-7xl gap-14 px-4 sm:px-6 lg:px-8">
        {groups.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Our partners will be listed here soon.</p>
        ) : (
          groups.map((g) => (
            <section key={g.tier} aria-labelledby={`tier-${g.tier}`} className="grid gap-6">
              <h2 id={`tier-${g.tier}`} className="font-display text-2xl font-bold">
                {GROUP_TITLES[g.tier]}
              </h2>
              <ul className={g.tier === "TITLE" ? "grid gap-6 md:grid-cols-2" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
                {g.items.map((s) => (
                  <li key={s.id}>
                    <Spotlight className="reveal h-full rounded-3xl">
                      <div className="grid h-full content-start gap-4 rounded-3xl border border-line bg-surface p-6">
                        <div className={`grid place-items-center rounded-2xl bg-tile px-6 ${g.tier === "TITLE" ? "h-36" : "h-28"}`}>
                          {s.logo ? (
                            <Picture image={s.logo} sizes="320px" alt={s.name} imgClassName={`w-auto object-contain ${g.tier === "TITLE" ? "max-h-24" : "max-h-16"}`} />
                          ) : (
                            <span className="font-display text-2xl font-bold text-night">{s.name}</span>
                          )}
                        </div>
                        <div className="grid gap-1">
                          <h3 className="font-semibold">{s.name}</h3>
                          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-leaf">{s.label || SPONSOR_TIER_LABELS[s.tier]}</p>
                          {s.description && <p className="pt-1 text-sm text-muted">{s.description}</p>}
                        </div>
                        {s.website && (
                          <a href={s.website} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-sm text-leaf hover:underline">
                            Visit website <ArrowUpRight className="size-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </Spotlight>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {site.email && (
          <section className="reveal grid gap-3 rounded-3xl border border-leaf/25 bg-[radial-gradient(circle_at_85%_15%,rgb(92_201_123/0.18),transparent_50%)] p-8 sm:p-10">
            <h2 className="font-display text-3xl font-bold tracking-tight">Want to partner with us?</h2>
            <p className="max-w-xl text-muted">We work with companies and communities that care about students who build. Let&apos;s talk about your next event with us.</p>
            <a href={`mailto:${site.email}?subject=${encodeURIComponent("Partnering with " + site.clubName)}`} className="mt-2 inline-flex w-fit rounded-full bg-leaf px-5 py-3 font-semibold text-night">
              Email {site.email}
            </a>
          </section>
        )}
      </div>
    </div>
  );
}
