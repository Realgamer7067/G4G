import type { Metadata } from "next";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { PageViewBeacon } from "@/components/site/page-view-beacon";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getBannerAnnouncement } from "@/lib/data/announcements";
import { getNavigation } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { ogImage } from "@/lib/media/public-image";

// Public pages render per request from cached data, so date-based states (open/closed, countdowns) stay correct.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const og = s.seo.ogImage ? ogImage(s.seo.ogImage) : null;
  return {
    title: { default: s.clubName, template: s.seo.titleTemplate },
    description: s.seo.defaultDescription || s.description,
    applicationName: s.clubName,
    openGraph: {
      type: "website",
      siteName: s.clubName,
      locale: "en_IN",
      images: og ? [{ url: og.url, width: og.width, height: og.height }] : undefined,
    },
    twitter: { card: og ? "summary_large_image" : "summary" },
  };
}

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [settings, nav, banner] = await Promise.all([getSiteSettings(), getNavigation(), getBannerAnnouncement()]);
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-leaf focus:px-3 focus:py-2 focus:text-night"
      >
        Skip to content
      </a>
      {banner && <AnnouncementBanner announcement={banner} />}
      <SiteHeader clubName={settings.clubName} shortName={settings.shortName} nav={nav} cta={settings.navCta} logo={settings.logo} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} nav={nav} />
      <PageViewBeacon />
      <SmoothScroll />
    </div>
  );
}
