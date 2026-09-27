import Link from "next/link";
import { PageIntro } from "@/components/site/page-intro";
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
    <div className="pb-24">
      <PageIntro
        layout="stacked"
        eyebrow={page.navLabel}
        title={
          team ? (
            <>
              The people behind <span className="text-leaf">{team.term.label}</span>
            </>
          ) : (
            "Meet the team"
          )
        }
        lead="Students who plan the sessions, write the problems, design the posters and keep the lights on."
      />
      <div className="container-x grid gap-16">
        {team ? (
          <TeamGroups members={team.members} />
        ) : (
          <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Our team page is being put together. Check back soon.</p>
        )}

        {archive.length > 0 && (
          <section className="grid gap-3 border-t border-line pt-8">
            <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Past teams</h2>
            <div className="flex flex-wrap gap-2">
              {archive.map((t) => (
                <Link
                  key={t.id}
                  href={`/team/${t.startYear}`}
                  className="rounded-full border border-line px-3 py-1.5 text-sm transition-colors duration-200 hover:border-leaf/40 hover:text-leaf"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
