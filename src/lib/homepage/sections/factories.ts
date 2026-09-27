// src/lib/homepage/sections/factories.ts
import type { Section, SectionType } from "./schema";

export function newSectionId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `sec_${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10)}`;
}

/** A valid, minimally-filled section of the given type — always passes `sectionSchema`. */
export function blankSection(type: SectionType): Section {
  const id = newSectionId();
  const base = { id, enabled: true } as const;
  switch (type) {
    case "hero":
      return { ...base, type, content: { heading: "New heading", ctas: [], backgroundVariant: "dots", terminalLines: [], showLogoTile: true, showSocials: false, imageId: null, secondaryImageId: null, showNextEvent: true } };
    case "about":
      return { ...base, type, content: { body: "", imageId: null, activities: [] } };
    case "stats":
      return { ...base, type, content: { items: [] } };
    case "event_spotlight":
      return { ...base, type, content: { mode: "next_upcoming", eventId: null, showCountdown: true } };
    case "announcements":
      return { ...base, type, content: { maxItems: 3 } };
    case "achievements":
      return { ...base, type, content: { items: [] } };
    case "featured_team":
      return { ...base, type, content: { maxItems: 8 } };
    case "gallery_highlights":
      return { ...base, type, content: { mode: "latest", albumId: null, maxItems: 8 } };
    case "sponsors":
      return { ...base, type, content: { tierFilter: [] } };
    case "social":
      return { ...base, type, content: { style: "icons" } };
    case "cta":
      return { ...base, type, content: { heading: "Ready to get involved?", ctas: [{ label: "Join us", href: "/events", style: "primary" }], backgroundVariant: "gradient" } };
    case "marquee":
      return { ...base, type, content: { items: ["DSA", "Web Dev", "AI/ML", "Open Source"] } };
  }
}
