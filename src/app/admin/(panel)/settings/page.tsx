import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { imageUrl, type PublicImage } from "@/lib/media/public-image";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Site settings" };

const toUploaded = (image: PublicImage | null) => (image ? { id: image.id, url: imageUrl(image, 400), alt: image.alt } : null);

export default async function SettingsPage() {
  await requirePagePermission("settings.manage");
  const s = await loadSiteSettings();
  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader
        eyebrow="Website"
        title="Site settings"
        description="Club details, contact info, social links, footer and search defaults. Changes go live as soon as you save."
      />
      <SettingsForm
        timezones={Intl.supportedValuesOf("timeZone")}
        values={{
          clubName: s.clubName,
          shortName: s.shortName,
          tagline: s.tagline,
          description: s.description,
          universityName: s.universityName,
          email: s.email,
          phone: s.phone,
          address: s.address,
          mapUrl: s.mapUrl,
          timezone: s.timezone,
          logo: toUploaded(s.logo),
          ogImage: toUploaded(s.seo.ogImage),
          socials: s.socials,
          footer: s.footer,
          seo: { titleTemplate: s.seo.titleTemplate, defaultDescription: s.seo.defaultDescription },
          navCta: s.navCta,
        }}
      />
    </div>
  );
}
