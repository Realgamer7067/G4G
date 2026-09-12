import { assertPageEnabled } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { CONTACT_DEFAULTS, contactContentSchema } from "@/lib/pages/contact-schema";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("CONTACT", { title: "Contact us", description: "Get in touch." });
}

export default async function ContactPage() {
  const [page, site] = await Promise.all([assertPageEnabled("CONTACT"), getSiteSettings()]);
  const parsed = contactContentSchema.safeParse(page.content);
  const content = parsed.success ? parsed.data : CONTACT_DEFAULTS;

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">{page.navLabel}</h1>
      {content.intro && <p className="text-lg text-muted">{content.intro}</p>}
      <dl className="grid gap-3">
        {content.showEmail && site.email && (
          <div>
            <dt className="text-sm text-muted">Email</dt>
            <dd>
              <a href={`mailto:${site.email}`} className="text-leaf hover:underline">
                {site.email}
              </a>
            </dd>
          </div>
        )}
        {content.showPhone && site.phone && (
          <div>
            <dt className="text-sm text-muted">Phone</dt>
            <dd>{site.phone}</dd>
          </div>
        )}
        {content.showAddress && site.address && (
          <div>
            <dt className="text-sm text-muted">Address</dt>
            <dd>{site.address}</dd>
          </div>
        )}
        {content.showMap && site.mapUrl && (
          <div>
            <dt className="text-sm text-muted">Map</dt>
            <dd>
              <a href={site.mapUrl} target="_blank" rel="noopener noreferrer" className="text-leaf hover:underline">
                Open in maps
              </a>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
