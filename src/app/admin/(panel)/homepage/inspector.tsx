"use client";

import type { Section } from "@/lib/homepage/sections/schema";
import { AboutForm } from "./section-forms/about";
import { AchievementsForm } from "./section-forms/achievements";
import { CtaForm } from "./section-forms/cta";
import { EventSpotlightForm } from "./section-forms/event-spotlight";
import { HeroForm } from "./section-forms/hero";
import { SocialForm } from "./section-forms/social";
import { StatsForm } from "./section-forms/stats";

export function Inspector({ section, onUpdate }: { section: Section | null; onUpdate: (patch: Partial<Section>) => void }) {
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
          <AboutForm section={section} onUpdate={onUpdate} />
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
          <AchievementsForm section={section} onUpdate={onUpdate} />
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
    default:
      return <div className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">Editing for this section type isn&apos;t built yet.</div>;
  }
}
