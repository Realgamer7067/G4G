// src/app/admin/(panel)/team/[termId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { groupByDomain, groupByTier, teamLinksSchema, type TeamMemberDTO } from "@/lib/team/schema";
import { CopyTermForm } from "./copy-term-form";
import { MemberGroupList } from "./member-list";

export const metadata: Metadata = { title: "Team members" };

export default async function TeamTermPage({ params, searchParams }: PageProps<"/admin/team/[termId]">) {
  await requirePagePermission("team.manage");
  const { termId } = await params;
  const sp = await searchParams;
  const term = await db.teamTerm.findUnique({ where: { id: termId } });
  if (!term) notFound();

  const rows = await db.teamMember.findMany({
    where: { termId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { photo: { select: publicImageSelect }, domain: { select: { id: true, name: true, order: true } } },
  });
  const members: TeamMemberDTO[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    title: m.title,
    tier: m.tier,
    bio: m.bio,
    featured: m.featured,
    order: m.order,
    links: teamLinksSchema.parse(m.links),
    photo: toPublicImage(m.photo),
    domain: m.domain,
  }));
  const tierGroups = groupByTier(members);

  return (
    <div className="grid max-w-5xl gap-8">
      <Link href="/admin/team" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> Terms &amp; domains
      </Link>
      <PageHeader
        eyebrow="Team"
        title={term.label}
        description={`${members.length} member${members.length === 1 ? "" : "s"}${term.isCurrent ? " · Current term" : ""}`}
        actions={
          <Link href={`/admin/team/${term.id}/new`} className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            <Plus className="size-4" aria-hidden="true" /> Add member
          </Link>
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Member deleted.
        </p>
      )}
      {members.length === 0 && <CopyTermForm termId={term.id} />}
      {tierGroups.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">No members yet.</p>
          <Link href={`/admin/team/${term.id}/new`} className="text-sm text-leaf hover:underline">
            Add the first one
          </Link>
        </div>
      ) : (
        tierGroups.map((g) => (
          <section key={g.tier} className="grid gap-3">
            <h2 className="font-display text-lg font-semibold">{g.label}</h2>
            {g.tier === "DOMAIN_LEAD" || g.tier === "MEMBER" ? (
              groupByDomain(g.members).map((dg) => (
                <div key={dg.domain?.id ?? "other"} className="grid gap-2">
                  <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">{dg.domain?.name ?? "No domain"}</p>
                  <MemberGroupList termId={term.id} members={dg.members} />
                </div>
              ))
            ) : (
              <MemberGroupList termId={term.id} members={g.members} />
            )}
          </section>
        ))
      )}
    </div>
  );
}
