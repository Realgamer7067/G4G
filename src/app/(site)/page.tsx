import { SectionRenderer } from "@/components/homepage/section-renderer";
import { getPublishedHomepage } from "@/lib/data/homepage";
import { getSiteSettings } from "@/lib/data/site";

export default async function HomePage() {
  const [sections, site] = await Promise.all([getPublishedHomepage(), getSiteSettings()]);
  if (sections.length === 0) {
    return (
      <section className="mx-auto grid max-w-3xl gap-3 px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">{site.clubName}</h1>
        <p className="text-muted">The homepage hasn&apos;t been published yet.</p>
      </section>
    );
  }
  return <SectionRenderer sections={sections} images={{}} socials={site.socials} now={new Date()} timezone={site.timezone} />;
}
