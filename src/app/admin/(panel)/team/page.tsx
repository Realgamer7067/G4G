import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { DomainForm } from "./domain-forms";
import { NewTeamTermForm, TeamTermRow } from "./term-forms";

export const metadata: Metadata = { title: "Team" };

export default async function TeamAdminPage({ searchParams }: PageProps<"/admin/team">) {
  await requirePagePermission("team.manage");
  const sp = await searchParams;
  const [terms, domains] = await Promise.all([
    db.teamTerm.findMany({ orderBy: { startYear: "desc" }, include: { _count: { select: { members: true } } } }),
    db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], include: { _count: { select: { members: true } } } }),
  ]);

  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader eyebrow="Content" title="Team" description="Terms, domains and the members who show up on the Team page." />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Term deleted.
        </p>
      )}
      <Panel title="Terms">
        <NewTeamTermForm />
        {terms.length === 0 ? (
          <p className="text-sm text-muted">No terms yet. Add one above.</p>
        ) : (
          <ul className="grid gap-3">
            {terms.map((t) => (
              <TeamTermRow
                key={t.id}
                term={{ id: t.id, label: t.label, startYear: t.startYear, isCurrent: t.isCurrent, isPublished: t.isPublished, memberCount: t._count.members }}
              />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Domains" description="Groups for domain leads and members, e.g. Development, Design.">
        <DomainForm />
        <ul className="grid gap-3">
          {domains.map((d, i) => (
            <li key={d.id}>
              <DomainForm id={d.id} name={d.name} memberCount={d._count.members} isFirst={i === 0} isLast={i === domains.length - 1} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
