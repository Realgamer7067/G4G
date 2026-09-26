// src/app/admin/(panel)/team/[termId]/new/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Add team member" };

export default async function NewTeamMemberPage({ params }: PageProps<"/admin/team/[termId]/new">) {
  await requirePagePermission("team.manage");
  const { termId } = await params;
  const term = await db.teamTerm.findUnique({ where: { id: termId } });
  if (!term) notFound();
  const domains = await db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });

  return (
    <div className="grid max-w-2xl gap-8">
      <Link href={`/admin/team/${term.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> {term.label}
      </Link>
      <PageHeader eyebrow="Team" title="Add member" />
      <MemberForm
        term={{ id: term.id, label: term.label }}
        domains={domains.map((d) => ({ id: d.id, name: d.name }))}
        values={{
          id: null,
          name: "",
          photo: null,
          title: "",
          tier: "MEMBER",
          domainId: "",
          bio: "",
          links: { linkedin: "", github: "", instagram: "", website: "", x: "" },
          featured: false,
        }}
      />
    </div>
  );
}
