import type { PageKey } from "@/generated/prisma/client";

export const SITE_DEFAULTS = {
  clubName: "GeeksforGeeks Student Chapter",
  shortName: "GFG VIT Bhopal",
  tagline: "Learn it. Build it. Ship it together.",
  description:
    "A student-run community for people who like to build: workshops, hackathons, open-source sprints and a crew that actually pushes code.",
  universityName: "VIT Bhopal University",
  // Left empty on purpose: the site hides contact details that aren't set, rather than showing a placeholder.
  email: "",
  timezone: "Asia/Kolkata",
  socials: { instagram: "", linkedin: "", github: "", youtube: "", discord: "", whatsapp: "", x: "", custom: [] },
  footer: { blurb: "Built by students, for students.", columns: [], copyright: "GeeksforGeeks Student Chapter, VIT Bhopal" },
  seo: { titleTemplate: "%s · GFG VIT Bhopal", defaultDescription: "Workshops, hackathons and a community of student builders." },
}; // not `as const`: readonly arrays don't satisfy Prisma's JSON input types

export const PAGE_DEFAULTS: { key: PageKey; navLabel: string; navOrder: number; showInNav: boolean }[] = [
  { key: "HOME", navLabel: "Home", navOrder: 0, showInNav: false },
  { key: "ABOUT", navLabel: "About", navOrder: 1, showInNav: true },
  { key: "EVENTS", navLabel: "Events", navOrder: 2, showInNav: true },
  { key: "TEAM", navLabel: "Team", navOrder: 3, showInNav: true },
  { key: "GALLERY", navLabel: "Gallery", navOrder: 4, showInNav: true },
  { key: "ANNOUNCEMENTS", navLabel: "Announcements", navOrder: 5, showInNav: true },
  { key: "SPONSORS", navLabel: "Partners", navOrder: 6, showInNav: true },
  { key: "CONTACT", navLabel: "Contact", navOrder: 7, showInNav: true },
];

export const DOMAIN_DEFAULTS = [
  "Development", "Design", "DevOps", "AI/ML", "Cybersecurity", "Content", "Marketing", "Events",
];

export const CATEGORY_DEFAULTS = ["Workshop", "Hackathon", "Talk", "Contest", "Meetup", "Orientation"];
