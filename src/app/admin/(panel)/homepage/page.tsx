import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadDraftHomepage } from "@/lib/data/homepage";
import { HomepageBuilder } from "./homepage-builder";

export const metadata: Metadata = { title: "Homepage" };

export default async function HomepageAdminPage() {
  await requirePagePermission("homepage.edit");
  const draft = await loadDraftHomepage();
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Website" title="Homepage" description="Compose the sections that appear on the public homepage." />
      <HomepageBuilder revisionId={draft.id} initialSections={draft.sections} />
    </div>
  );
}
