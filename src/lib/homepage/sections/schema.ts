import { z } from "zod";

export const SECTION_TYPES = [
  "hero",
  "about",
  "stats",
  "event_spotlight",
  "announcements",
  "achievements",
  "featured_team",
  "gallery_highlights",
  "sponsors",
  "social",
  "cta",
  "marquee",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

const idSchema = z.string().min(1).max(64);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const ctaLinkSchema = z.object({
  label: z.string().trim().min(1, "Add a label.").max(40),
  href: z.string().trim().min(1, "Add a link.").max(300),
  style: z.enum(["primary", "secondary"]),
});

export const heroContentSchema = z.object({
  eyebrow: optionalText(60),
  heading: z.string().trim().min(1, "Add a heading.").max(120),
  highlightedWord: optionalText(40),
  subheading: optionalText(240),
  ctas: z.array(ctaLinkSchema).max(2).default([]),
  backgroundVariant: z.enum(["dots", "rings", "grid", "glow"]).default("dots"),
  terminalLines: z.array(z.string().trim().max(80)).max(6).default([]),
  showLogoTile: z.boolean().default(true),
  showSocials: z.boolean().default(false),
  /** Main (4:5) and offset photos for the hero media stack. Without them the hero falls back to a typographic panel. */
  imageId: z.string().nullable().default(null),
  secondaryImageId: z.string().nullable().default(null),
  /** Floating "Next up" card linking to the next upcoming event, when there is one. */
  showNextEvent: z.boolean().default(true),
});
export type HeroContent = z.infer<typeof heroContentSchema>;

export const ABOUT_ACTIVITY_ICONS = ["book", "code", "users", "rocket", "trophy", "lightbulb", "branch", "mic"] as const;
const aboutActivitySchema = z.object({
  id: idSchema,
  icon: z.enum(ABOUT_ACTIVITY_ICONS).default("code"),
  title: z.string().trim().min(1, "Add a title.").max(40),
  description: z.string().trim().max(160).default(""),
});
export const aboutContentSchema = z.object({
  heading: optionalText(80),
  body: z.string().trim().max(2000).default(""),
  imageId: z.string().nullable().default(null),
  activities: z.array(aboutActivitySchema).max(4).default([]),
});
export type AboutActivity = z.infer<typeof aboutActivitySchema>;
export type AboutContent = z.infer<typeof aboutContentSchema>;

export const STAT_SOURCES = ["manual", "events_completed", "team_members", "gallery_photos"] as const;
const statItemSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1, "Add a label.").max(40),
  value: z.number().min(0).max(1_000_000).nullable().default(null),
  suffix: optionalText(10),
  source: z.enum(STAT_SOURCES).default("manual"),
});
export const statsContentSchema = z.object({
  items: z.array(statItemSchema).max(6).default([]),
});
export type StatsContent = z.infer<typeof statsContentSchema>;
export type StatItem = z.infer<typeof statItemSchema>;

export const eventSpotlightContentSchema = z.object({
  mode: z.enum(["next_upcoming", "pinned"]).default("next_upcoming"),
  eventId: z.string().nullable().default(null),
  showCountdown: z.boolean().default(true),
});
export type EventSpotlightContent = z.infer<typeof eventSpotlightContentSchema>;

export const announcementsContentSchema = z.object({
  maxItems: z.number().int().min(1).max(10).default(3),
});
export type AnnouncementsContent = z.infer<typeof announcementsContentSchema>;

const achievementItemSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1, "Add a title.").max(80),
  description: z.string().trim().max(300).default(""),
  year: z.number().int().min(1990).max(2100),
  imageId: z.string().nullable().default(null),
  link: optionalText(300),
});
export const achievementsContentSchema = z.object({
  items: z.array(achievementItemSchema).max(12).default([]),
});
export type AchievementsContent = z.infer<typeof achievementsContentSchema>;
export type AchievementItem = z.infer<typeof achievementItemSchema>;

export const featuredTeamContentSchema = z.object({
  maxItems: z.number().int().min(1).max(12).default(8),
});
export type FeaturedTeamContent = z.infer<typeof featuredTeamContentSchema>;

export const galleryHighlightsContentSchema = z.object({
  mode: z.enum(["latest", "album"]).default("latest"),
  albumId: z.string().nullable().default(null),
  maxItems: z.number().int().min(1).max(24).default(8),
});
export type GalleryHighlightsContent = z.infer<typeof galleryHighlightsContentSchema>;

export const SPONSOR_TIERS = ["TITLE", "POWERED_BY", "TECHNOLOGY_PARTNER", "COMMUNITY_PARTNER", "PARTNER"] as const;
export const sponsorsContentSchema = z.object({
  tierFilter: z.array(z.enum(SPONSOR_TIERS)).default([]),
});
export type SponsorsContent = z.infer<typeof sponsorsContentSchema>;

export const socialContentSchema = z.object({
  style: z.enum(["icons", "buttons"]).default("icons"),
});
export type SocialContent = z.infer<typeof socialContentSchema>;

export const ctaContentSchema = z.object({
  eyebrow: optionalText(60),
  heading: z.string().trim().min(1, "Add a heading.").max(120),
  subheading: optionalText(200),
  ctas: z.array(ctaLinkSchema).min(1).max(2).default([]),
  backgroundVariant: z.enum(["solid", "gradient", "outline"]).default("gradient"),
});
export type CtaContent = z.infer<typeof ctaContentSchema>;

export const marqueeContentSchema = z.object({
  items: z.array(z.string().trim().min(1).max(40)).min(1, "Add at least one item.").max(12).default([]),
});
export type MarqueeContent = z.infer<typeof marqueeContentSchema>;

const baseSectionFields = {
  id: idSchema,
  enabled: z.boolean().default(true),
  anchorId: optionalText(60),
  headingOverride: optionalText(120),
  subheadingOverride: optionalText(240),
};

export const sectionSchema = z.discriminatedUnion("type", [
  z.object({ ...baseSectionFields, type: z.literal("hero"), content: heroContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("about"), content: aboutContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("stats"), content: statsContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("event_spotlight"), content: eventSpotlightContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("announcements"), content: announcementsContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("achievements"), content: achievementsContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("featured_team"), content: featuredTeamContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("gallery_highlights"), content: galleryHighlightsContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("sponsors"), content: sponsorsContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("social"), content: socialContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("cta"), content: ctaContentSchema }),
  z.object({ ...baseSectionFields, type: z.literal("marquee"), content: marqueeContentSchema }),
]);
export type Section = z.infer<typeof sectionSchema>;

export const homepageSectionsSchema = z.array(sectionSchema).max(40);
export type HomepageSections = z.infer<typeof homepageSectionsSchema>;

export type SectionOfType<T extends SectionType> = Extract<Section, { type: T }>;
