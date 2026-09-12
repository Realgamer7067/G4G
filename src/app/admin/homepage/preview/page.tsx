import type { Metadata } from "next";
import { SectionRenderer } from "@/components/homepage/section-renderer";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadDraftHomepageSections, resolveHomepageImages } from "@/lib/data/homepage";
import { getSiteSettings } from "@/lib/data/site";

export const metadata: Metadata = { title: "Homepage preview", robots: { index: false, follow: false } };

export default async function HomepagePreviewPage() {
  await requirePagePermission("homepage.edit");
  const sections = await loadDraftHomepageSections();
  const [site, images] = await Promise.all([getSiteSettings(), resolveHomepageImages(sections)]);
  return (
    <div className="min-h-screen bg-night text-frost">
      <div className="sticky top-0 z-10 bg-amber/10 px-4 py-2 text-center text-xs text-amber">Draft preview — this is not what&apos;s currently live.</div>
      <SectionRenderer sections={sections} images={images} socials={site.socials} now={new Date()} timezone={site.timezone} />
    </div>
  );
}
