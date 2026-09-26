// src/app/admin/(panel)/team/[termId]/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { teamLinksSchema } from "@/lib/team/schema";
import { DeleteMemberForm, MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Edit team member" };

export default async function EditTeamMemberPage({ params, searchParams }: PageProps<"/admin/team/[termId]/[id]">) {
  await requirePagePermission("team.manage");
  const { termId, id } = await params;
  const sp = await searchParams;
  const [term, member, domains] = await Promise.all([
    db.teamTerm.findUnique({ where: { id: termId } }),
    db.teamMember.findUnique({ where: { id }, include: { photo: { select: publicImageSelect } } }),
    db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }),
  ]);
  if (!term || !member || member.termId !== term.id) notFound();
  const photo = toPublicImage(member.photo);
  const links = teamLinksSchema.parse(member.links);

  return (
    <div className="grid max-w-2xl gap-8">
      <Link href={`/admin/team/${term.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> {term.label}
      </Link>
      <PageHeader eyebrow="Team" title={member.name} />
      {sp.created && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Member added.
        </p>
      )}
      <MemberForm
        term={{ id: term.id, label: term.label }}
        domains={domains.map((d) => ({ id: d.id, name: d.name }))}
        values={{
          id: member.id,
          name: member.name,
          photo: photo ? { id: photo.id, url: imageUrl(photo, 400), alt: photo.alt } : null,
          title: member.title,
          tier: member.tier,
          domainId: member.domainId ?? "",
          bio: member.bio,
          links,
          featured: member.featured,
        }}
      />
      <Panel title="Delete member">
        <DeleteMemberForm id={member.id} name={member.name} />
      </Panel>
    </div>
  );
}
