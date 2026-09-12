import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { loadDraftHomepage, loadHomepageHistory } from "@/lib/data/homepage";
import { HomepageBuilder } from "./homepage-builder";

export const metadata: Metadata = { title: "Homepage" };

export default async function HomepageAdminPage() {
  const user = await requirePagePermission("homepage.edit");
  const [draft, history] = await Promise.all([loadDraftHomepage(), loadHomepageHistory()]);
  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Website" title="Homepage" description="Compose the sections that appear on the public homepage." />
      <HomepageBuilder revisionId={draft.id} initialSections={draft.sections} canPublish={can(user, "homepage.publish")} history={history} />
    </div>
  );
}
