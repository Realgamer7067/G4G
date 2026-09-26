import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TeamGroups } from "@/components/site/team/team-groups";
import { assertPageEnabled } from "@/lib/data/pages";
import { getCurrentTeam, getPublicTeamByYear } from "@/lib/data/team";
import { metadataForPage } from "@/lib/seo";

const YEAR_RE = /^\d{4}$/;

export async function generateMetadata({ params }: PageProps<"/team/[term]">): Promise<Metadata> {
  const { term } = await params;
  if (!YEAR_RE.test(term)) return {};
  const data = await getPublicTeamByYear(Number(term));
  if (!data) return {};
  return metadataForPage("TEAM", { title: `${data.term.label} team`, description: `The chapter's ${data.term.label} team.` });
}

export default async function TeamArchivePage({ params }: PageProps<"/team/[term]">) {
  await assertPageEnabled("TEAM");
  const { term } = await params;
  if (!YEAR_RE.test(term)) notFound();
  const startYear = Number(term);

  const current = await getCurrentTeam();
  if (current?.term.startYear === startYear) redirect("/team");

  const data = await getPublicTeamByYear(startYear);
  if (!data) notFound();

  return (
    <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:px-8">
      <header className="grid gap-3">
        <Link href="/team" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-frost">
          <ArrowLeft className="size-4" aria-hidden="true" /> Current team
        </Link>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">{data.term.label} team</h1>
      </header>
      <TeamGroups members={data.members} />
    </div>
  );
}
