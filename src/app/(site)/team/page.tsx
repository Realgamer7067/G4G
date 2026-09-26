import Link from "next/link";
import { TeamGroups } from "@/components/site/team/team-groups";
import { assertPageEnabled } from "@/lib/data/pages";
import { getCurrentTeam, getTeamArchive } from "@/lib/data/team";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("TEAM", { title: "Our team", description: "The students who run the chapter." });
}

export default async function TeamPage() {
  const page = await assertPageEnabled("TEAM");
  const [team, archive] = await Promise.all([getCurrentTeam(), getTeamArchive()]);

  return (
    <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:px-8">
      <header className="grid gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          {team ? `The people behind ${team.term.label}` : "Meet the team"}
        </h1>
      </header>

      {team ? (
        <TeamGroups members={team.members} />
      ) : (
        <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">
          Our team page is being put together. Check back soon.
        </p>
      )}

      {archive.length > 0 && (
        <section className="grid gap-3 border-t border-line pt-8">
          <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Past teams</h2>
          <div className="flex flex-wrap gap-2">
            {archive.map((t) => (
              <Link key={t.id} href={`/team/${t.startYear}`} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-leaf/40 hover:text-leaf">
                {t.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
