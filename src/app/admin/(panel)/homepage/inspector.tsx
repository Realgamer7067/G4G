"use client";

import type { HomepageImageDTO } from "@/lib/data/homepage";
import type { Section } from "@/lib/homepage/sections/schema";
import { AboutForm } from "./section-forms/about";
import { AchievementsForm } from "./section-forms/achievements";
import { AnnouncementsForm } from "./section-forms/announcements";
import { CtaForm } from "./section-forms/cta";
import { EventSpotlightForm } from "./section-forms/event-spotlight";
import { FeaturedTeamForm } from "./section-forms/featured-team";
import { GalleryHighlightsForm } from "./section-forms/gallery-highlights";
import { HeroForm } from "./section-forms/hero";
import { SocialForm } from "./section-forms/social";
import { SponsorsForm } from "./section-forms/sponsors";
import { StatsForm } from "./section-forms/stats";

export function Inspector({
  section,
  onUpdate,
  images,
  onImageResolved,
}: {
  section: Section | null;
  onUpdate: (patch: Partial<Section>) => void;
  images: Record<string, HomepageImageDTO>;
  onImageResolved: (id: string, image: HomepageImageDTO) => void;
}) {
  if (!section) return <div className="grid place-items-center rounded-2xl border border-dashed border-line p-10 text-sm text-muted">Select a section to edit it.</div>;

  const common = (
    <div className="mb-4 grid gap-3 border-b border-line pb-4">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Heading override</span>
        <input
          value={section.headingOverride ?? ""}
          onChange={(e) => onUpdate({ headingOverride: e.target.value || undefined })}
          className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm"
        />
      </label>
    </div>
  );

  switch (section.type) {
    case "hero":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <HeroForm section={section} onUpdate={onUpdate} />
        </div>
      );
    case "about":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <AboutForm section={section} onUpdate={onUpdate} images={images} onImageResolved={onImageResolved} />
        </div>
      );
    case "stats":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <StatsForm section={section} onUpdate={onUpdate} />
        </div>
      );
    case "event_spotlight":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <EventSpotlightForm section={section} onUpdate={onUpdate} />
        </div>
      );
    case "achievements":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <AchievementsForm section={section} onUpdate={onUpdate} images={images} onImageResolved={onImageResolved} />
        </div>
      );
    case "social":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <SocialForm section={section} onUpdate={onUpdate} />
        </div>
      );
    case "cta":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <CtaForm section={section} onUpdate={onUpdate} />
        </div>
      );
    case "announcements":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <AnnouncementsForm section={section} onUpdate={onUpdate} />
        </div>
      );
    case "featured_team":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <FeaturedTeamForm section={section} onUpdate={onUpdate} />
        </div>
      );
    case "gallery_highlights":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <GalleryHighlightsForm section={section} onUpdate={onUpdate} />
        </div>
      );
    case "sponsors":
      return (
        <div className="rounded-2xl border border-line bg-surface p-4">
          {common}
          <SponsorsForm section={section} onUpdate={onUpdate} />
        </div>
      );
    default:
      return <div className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">Editing for this section type isn&apos;t built yet.</div>;
  }
}
