import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { SponsorForm } from "../sponsor-form";

export const metadata: Metadata = { title: "Add sponsor" };

export default async function NewSponsorPage() {
  await requirePagePermission("sponsors.manage");
  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/admin/sponsors" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All sponsors
      </Link>
      <PageHeader eyebrow="Sponsors" title="Add sponsor" />
      <SponsorForm
        values={{ id: null, name: "", logo: null, website: "", description: "", tier: "PARTNER", customLabel: "", showOnSponsorsPage: true, isActive: true, order: 0 }}
      />
    </div>
  );
}
