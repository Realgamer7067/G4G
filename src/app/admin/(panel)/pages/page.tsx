import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadPageSettings } from "@/lib/data/pages";
import { IMPLEMENTED_PAGES, PAGE_ROUTES } from "@/lib/pages/registry";
import { PagesEditor } from "./pages-editor";

export const metadata: Metadata = { title: "Pages & navigation" };

export default async function PagesAdminPage() {
  await requirePagePermission("pages.manage");
  const pages = await loadPageSettings();
  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader
        eyebrow="Website"
        title="Pages & navigation"
        description="Turn pages on or off and choose what appears in the menu. A page that is off disappears from the menu and search engines, and its address shows “not found”."
      />
      <PagesEditor
        pages={pages.map((p) => ({
          key: p.key,
          enabled: p.enabled,
          showInNav: p.showInNav,
          navLabel: p.navLabel,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          href: PAGE_ROUTES[p.key],
          implemented: IMPLEMENTED_PAGES.has(p.key),
        }))}
      />
    </div>
  );
}
