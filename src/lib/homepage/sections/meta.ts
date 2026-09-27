// src/lib/homepage/sections/meta.ts
import type { SectionType } from "./schema";

export const SECTION_META: Record<SectionType, { label: string; description: string }> = {
  hero: { label: "Hero", description: "Big heading, subheading and call-to-action buttons at the top of the page." },
  about: { label: "About blurb", description: "A short introduction to the chapter with up to four activities and an optional photo." },
  stats: { label: "Stats", description: "A row of numbers (events run, team size, photos), manual or auto-computed." },
  event_spotlight: { label: "Event spotlight", description: "Highlights the next upcoming event or one you pin, with a countdown." },
  announcements: { label: "Announcements", description: "Recent announcements flagged to show on the homepage." },
  achievements: { label: "Achievements", description: "A timeline or grid of awards and milestones." },
  featured_team: { label: "Featured team", description: "Members marked \"featured\" from the current team." },
  gallery_highlights: { label: "Gallery highlights", description: "Recent or hand-picked photos from an album." },
  sponsors: { label: "Sponsors", description: "Sponsor logos, optionally filtered to specific tiers." },
  social: { label: "Social links", description: "Icons or buttons linking to the chapter's social accounts." },
  cta: { label: "Call to action", description: "A full-width banner with a heading and one or two buttons." },
  marquee: { label: "Topics strip", description: "A slowly scrolling strip of topics the chapter works on." },
};
