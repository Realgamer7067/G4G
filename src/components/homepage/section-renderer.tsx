// src/components/homepage/section-renderer.tsx
import type { HomepageSections } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";
import type { Socials } from "@/lib/settings/schema";
import { AboutSection } from "./sections/about";
import { AchievementsSection } from "./sections/achievements";
import { AnnouncementsSection } from "./sections/announcements";
import { CtaSection } from "./sections/cta";
import { EventSpotlightSection } from "./sections/event-spotlight";
import { FeaturedTeamSection } from "./sections/featured-team";
import { GalleryHighlightsSection } from "./sections/gallery-highlights";
import { HeroSection } from "./sections/hero";
import { SocialSection } from "./sections/social";
import { SponsorsSection } from "./sections/sponsors";
import { StatsSection } from "./sections/stats";

export function SectionRenderer({
  sections,
  images,
  socials,
  now,
  timezone,
}: {
  sections: HomepageSections;
  images: Record<string, PublicImage>;
  socials: Socials;
  now: Date;
  timezone: string;
}) {
  return (
    <>
      {sections
        .filter((s) => s.enabled)
        .map((section) => {
          switch (section.type) {
            case "hero":
              return <HeroSection key={section.id} section={section} socials={socials} />;
            case "about":
              return <AboutSection key={section.id} section={section} image={section.content.imageId ? (images[section.content.imageId] ?? null) : null} />;
            case "stats":
              return <StatsSection key={section.id} section={section} />;
            case "event_spotlight":
              return <EventSpotlightSection key={section.id} section={section} now={now} timezone={timezone} />;
            case "achievements":
              return <AchievementsSection key={section.id} section={section} images={images} />;
            case "social":
              return <SocialSection key={section.id} section={section} socials={socials} />;
            case "cta":
              return <CtaSection key={section.id} section={section} />;
            case "announcements":
              return <AnnouncementsSection key={section.id} section={section} />;
            case "featured_team":
              return <FeaturedTeamSection key={section.id} section={section} />;
            case "gallery_highlights":
              return <GalleryHighlightsSection key={section.id} section={section} />;
            case "sponsors":
              return <SponsorsSection key={section.id} section={section} />;
            default:
              return null;
          }
        })}
    </>
  );
}
