// src/lib/homepage/template.ts
import { newSectionId } from "./sections/factories";
import { homepageSectionsSchema, type AchievementItem, type HomepageSections } from "./sections/schema";

export type HomepageTemplateOptions = {
  /** Hero and About photos (upload ids). Left empty in the production starter draft. */
  heroImageId?: string | null;
  heroSecondaryImageId?: string | null;
  aboutImageId?: string | null;
  /** Milestones are only added when real (or clearly demo) data is supplied. */
  milestones?: Omit<AchievementItem, "id">[];
  /** Marks the copy as needing review; used for the never-published production starter draft. */
  reviewNote?: boolean;
};

/** The recommended homepage composition: each section has a different job and layout. */
export function homepageTemplate(opts: HomepageTemplateOptions = {}): HomepageSections {
  const section = <T extends object>(type: string, content: T, extra: Record<string, unknown> = {}) => ({ id: newSectionId(), enabled: true, type, content, ...extra });
  const sections = [
    section("hero", {
      eyebrow: opts.reviewNote ? "Draft copy: review before publishing" : "GeeksforGeeks Student Chapter · VIT Bhopal",
      heading: "Where curious builders become a community.",
      highlightedWord: "builders",
      subheading: "Workshops, contests and build nights run by students at VIT Bhopal. Show up curious, leave with something shipped.",
      ctas: [
        { label: "Explore events", href: "/events", style: "primary" },
        { label: "Meet the team", href: "/team", style: "secondary" },
      ],
      backgroundVariant: "dots",
      terminalLines: [],
      showLogoTile: true,
      showSocials: false,
      imageId: opts.heroImageId ?? null,
      secondaryImageId: opts.heroSecondaryImageId ?? null,
      showNextEvent: true,
    }),
    section("marquee", { items: ["DSA", "Web Dev", "AI/ML", "Open Source", "Competitive Programming", "Cloud & DevOps"] }),
    section("about", {
      heading: "Learn together. Build in public. Share what works.",
      body: "We are the GeeksforGeeks Student Chapter at VIT Bhopal: a student-run group for anyone who likes solving problems with code.\nNo prerequisites, no gatekeeping. Bring a laptop and a question, and we will find you a team.",
      imageId: opts.aboutImageId ?? null,
      activities: [
        { id: newSectionId(), icon: "book", title: "Learn", description: "Weekly sessions on DSA, web and ML, taught by students who just figured it out." },
        { id: newSectionId(), icon: "code", title: "Build", description: "Hack nights and project sprints where ideas turn into repos." },
        { id: newSectionId(), icon: "mic", title: "Share", description: "Talks, write-ups and demos so the next batch starts ahead." },
      ],
    }),
    section("event_spotlight", { mode: "next_upcoming", eventId: null, showCountdown: true }),
    section(
      "stats",
      {
        items: [
          { id: newSectionId(), label: "Events run", value: null, suffix: "+", source: "events_completed" },
          { id: newSectionId(), label: "Team members", value: null, source: "team_members" },
          { id: newSectionId(), label: "Moments captured", value: null, source: "gallery_photos" },
        ],
      },
      { headingOverride: "The chapter so far" },
    ),
    section("announcements", { maxItems: 3 }),
    section("gallery_highlights", { mode: "latest", albumId: null, maxItems: 5 }),
    section("featured_team", { maxItems: 4 }),
    ...(opts.milestones?.length
      ? [section("achievements", { items: opts.milestones.map((m) => ({ id: newSectionId(), ...m })) }, { headingOverride: "Milestones" })]
      : []),
    section("sponsors", { tierFilter: [] }),
    section("cta", {
      heading: "Build your next thing with people who care.",
      subheading: "Our events are free and open to every VIT Bhopal student. Pick one and come say hi.",
      ctas: [{ label: "Join an event", href: "/events", style: "primary" }],
      backgroundVariant: "gradient",
    }),
  ];
  return homepageSectionsSchema.parse(sections);
}
