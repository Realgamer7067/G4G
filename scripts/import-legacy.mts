/**
 * Imports the chapter's real content from the previous site (geeksforgeeksvitb.vercel.app):
 * site settings, About/Contact pages, the 2025–26 team with photos, past events with posters,
 * the event sponsor, milestones and stats, and a homepage built from them. Also removes the
 * `npm run seed:demo` placeholder content.
 *
 *   npm run import:legacy
 *
 * Idempotent: rerunning replaces what a previous run created (uploads are named `legacy-…`,
 * events and the term are matched by slug / start year). Photos are downloaded from the old site.
 */
import "dotenv/config";
import sharp from "sharp";
import type { Prisma, TeamTier } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { newSectionId } from "../src/lib/homepage/sections/factories";
import { homepageSectionsSchema } from "../src/lib/homepage/sections/schema";
import type { ImagePurpose } from "../src/lib/media/variants";
import { slugify } from "../src/lib/utils/slug";
import { deleteUploadFiles, saveImage } from "../src/server/media/save-image";

const OLD = "https://geeksforgeeksvitb.vercel.app";

async function download(path: string): Promise<Buffer> {
  const url = path.startsWith("http") ? path : `${OLD}/${path}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (attempt === 3) throw new Error(`Could not download ${url}: ${String(error)}`);
    }
  }
}

async function upload(path: string, purpose: ImagePurpose, alt: string, name: string): Promise<string> {
  const raw = await download(path);
  let crop: { x: number; y: number; width: number; height: number } | undefined;
  let buffer = raw;
  if (purpose === "TEAM") {
    // Portraits come in every shape. A square biased toward the top keeps faces in frame,
    // where a centred crop of a tall phone photo cuts through the forehead.
    buffer = await sharp(raw).rotate().toBuffer();
    const { width = 0, height = 0 } = await sharp(buffer).metadata();
    const side = Math.min(width, height);
    crop = { x: Math.round((width - side) / 2), y: height > width ? Math.round((height - side) * 0.18) : 0, width: side, height: side };
    if (side < 200) {
      // A couple of old photos are thumbnails; a small upscale meets the 200px minimum.
      buffer = await sharp(buffer).extract({ left: crop.x, top: crop.y, width: side, height: side }).resize(240, 240).jpeg({ quality: 90 }).toBuffer();
      crop = undefined;
    }
  }
  const row = await saveImage({ buffer, originalName: `legacy-${name}`, purpose, crop, alt, uploadedById: null });
  return row.id;
}

/** 10:00 on 2026-02-27 in India time → UTC Date. */
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`);

// ─── Remove demo content and anything a previous import created ───
const oldUploads = await db.upload.findMany({
  where: { OR: [{ originalName: { startsWith: "demo-" } }, { originalName: { startsWith: "legacy-" } }] },
  select: { id: true, storageKey: true, visibility: true },
});
await db.event.deleteMany({ where: { slug: { startsWith: "demo-" } } });
await db.galleryAlbum.deleteMany({ where: { slug: { startsWith: "demo-" } } });
await db.announcement.deleteMany({ where: { slug: { startsWith: "demo-" } } });
await db.form.deleteMany({ where: { slug: { startsWith: "demo-" } } });
const DEMO_NAMES = ["Aarav Mehta", "Ishita Rao", "Kabir Singh", "Ananya Iyer", "Rohan Das", "Meera Kulkarni", "Vihaan Joshi", "Sara Khan"];
await db.teamMember.deleteMany({ where: { name: { in: DEMO_NAMES } } });
// The demo seed made a 2026 term; drop it once it has no members left.
await db.teamTerm.deleteMany({ where: { members: { none: {} }, startYear: 2026 } });
await db.upload.deleteMany({ where: { id: { in: oldUploads.map((u) => u.id) } } });
for (const u of oldUploads) await deleteUploadFiles(u);

// ─── Site settings and pages ───
console.log("Settings and pages…");
const settings = await db.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
await db.siteSettings.update({
  where: { id: 1 },
  data: {
    clubName: "GFG Student Chapter, VIT Bhopal",
    shortName: "GFG VIT Bhopal",
    universityName: "VIT Bhopal University",
    tagline: "Where code meets community.",
    description: "The official GeeksforGeeks student chapter at VIT Bhopal. We build projects, host hackathons and help each other become better engineers.",
    email: "geeksforgeeks.vitb@vitbhopal.ac.in",
    address: "VIT Bhopal University, Kotri Kalan, Ashta, Near Indore Road, Bhopal, Madhya Pradesh 466114",
    mapUrl: "https://maps.google.com/?cid=11683664235421900675",
    socials: {
      ...(settings.socials as Record<string, unknown>),
      instagram: "https://instagram.com/geeksforgeeks_vitb",
      linkedin: "https://www.linkedin.com/company/geeksforgeeks-vitb",
      github: "https://github.com/GeeksforGeeks-VIT-Bhopal",
      youtube: "https://www.youtube.com/@geeksforgeeks_vitb",
    },
    footer: { ...(settings.footer as Record<string, unknown>), blurb: "Where code meets community. Est. 2021." },
    seo: {
      ...(settings.seo as Record<string, unknown>),
      titleTemplate: "%s · GFG VIT Bhopal",
      defaultDescription: "The official GeeksforGeeks student chapter at VIT Bhopal: hackathons, workshops, open source and a community of student builders.",
    },
  },
});
await db.pageSetting.update({
  where: { key: "ABOUT" },
  data: {
    content: {
      heading: "Architecting the future of tech",
      body: [
        "We are the official GeeksforGeeks student chapter at VIT Bhopal: a collective of builders, thinkers and innovators, founded in 2021 by five students who wanted to change the coding culture on campus.",
        "Our vision is a self-sustaining community of developers who don't just consume technology but define it, and to make VIT Bhopal a hub for technical innovation in Central India.",
        "Peer learning is at the heart of it. Seniors mentor juniors, knowledge is open-sourced and competition stays healthy.",
        "We bridge the gap between classroom theory and real-world deployment through hackathons, workshops and projects that ship.",
      ].join("\n"),
      imageId: null,
    },
  },
});
await db.pageSetting.update({
  where: { key: "CONTACT" },
  data: {
    content: {
      intro: "Have a question about our events, want to collaborate on a workshop, or just want to say hi? We'd love to hear from you. We usually reply within a day.",
      showEmail: true,
      showPhone: false,
      showAddress: true,
      showMap: true,
    },
  },
});

// ─── Team 2025–26 ───
console.log("Team photos…");
const DOMAINS = [
  { name: "Technical", slug: "technical" },
  { name: "Events", slug: "events" },
  { name: "PR & Outreach", slug: "pr-outreach" },
  { name: "Social Media", slug: "social-media" },
  { name: "Design", slug: "design" },
  { name: "Marketing", slug: "marketing" },
];
const domainId: Record<string, string> = {};
for (const [order, d] of DOMAINS.entries()) {
  const row = await db.domain.upsert({ where: { slug: d.slug }, create: { ...d, order }, update: { name: d.name, order } });
  domainId[d.slug] = row.id;
}
await db.domain.updateMany({ where: { slug: { notIn: DOMAINS.map((d) => d.slug) } }, data: { order: 100 } });

type M = { name: string; title: string; tier: TeamTier; photo: string; domain?: string; linkedin?: string; featured?: boolean };
const lead = (name: string, title: string, domain: string, photo: string): M => ({ name, title, tier: "DOMAIN_LEAD", domain, photo });
const member = (name: string, title: string, domain: string, photo: string): M => ({ name, title, tier: "MEMBER", domain, photo });
const TEAM: M[] = [
  { name: "Prof. Jitendra Mathur", title: "Faculty Coordinator", tier: "FACULTY", photo: "images/team/jitendra-mathur.jpg" },
  {
    name: "Ashish Vishwakarma",
    title: "Chairperson",
    tier: "LEAD",
    photo: "images/team/ashish-vishwakarma.png",
    linkedin: "https://www.linkedin.com/in/ashish-vishwakarma04/",
    featured: true,
  },
  {
    name: "Khushang Singh",
    title: "Chairperson",
    tier: "LEAD",
    photo: "images/team/khushang-singh.jpg",
    linkedin: "https://www.linkedin.com/in/khushangsingh2004/",
    featured: true,
  },
  {
    name: "Swayam Prakash Panda",
    title: "Student Coordinator",
    tier: "CORE",
    photo: "images/team/swayam-panda.png",
    linkedin: "https://www.linkedin.com/in/swayam200/",
    featured: true,
  },
  { name: "Athrv Dixit", title: "Student Coordinator", tier: "CORE", photo: "images/team/athrv-dixit.jpg", linkedin: "https://www.linkedin.com/in/athrvdixit/", featured: true },
  lead("Akanksha Shahi", "Technical Lead", "technical", "images/team/technical/akanksha-shahi.jpg"),
  member("Kartikeya Shukla", "Web Dev", "technical", "images/team/technical/kartikeya.webp"),
  member("Krishna Kushwaha", "App Dev", "technical", "images/team/technical/krishna.jpg"),
  member("Praveen Kumar Patel", "AI/ML", "technical", "images/team/technical/praveen.jpg"),
  member("Tarni Jain", "Cloud", "technical", "images/team/technical/tarni.jpg"),
  member("Saumya Ambar", "Web Dev", "technical", "images/team/technical/saumya.jpg"),
  lead("Vishal Kumar", "Events Lead", "events", "images/team/event/vishal.jpg"),
  member("Vedanshika Singh", "Logistics", "events", "images/team/event/vedanshika.jpg"),
  member("Steve Kevin Dias", "Planning", "events", "images/team/event/steve.jpg"),
  member("Sri Shaswathi P", "Operations", "events", "images/team/event/sri.png"),
  member("Sagar Shukla", "Logistics", "events", "images/team/event/sagar.jpg"),
  member("Rishika", "Planning", "events", "images/team/event/rishika.jpg"),
  member("Ojasv Choubey", "Operations", "events", "images/team/event/ojasv.jpg"),
  member("Kshitika Atri", "Logistics", "events", "images/team/event/kshitika.png"),
  member("Kristi Kar Choudhur", "Planning", "events", "images/team/event/kristi.jpg"),
  member("Hiral Jawarkar", "Operations", "events", "images/team/event/hiral.jpg"),
  member("Ashlesha Kamal", "Logistics", "events", "images/team/event/ashlesha.jpg"),
  lead("Sejal Mishra", "PR Lead", "pr-outreach", "images/team/pr/sejal.jpg"),
  member("Sanskriti Tyagi", "Outreach", "pr-outreach", "images/team/pr/sanskriti.jpg"),
  member("Sakshi Dhananjay Bhosale", "Sponsorships", "pr-outreach", "images/team/pr/sakshi.jpg"),
  member("Priyanshi Mishra", "Outreach", "pr-outreach", "images/team/pr/priyanshi.jpg"),
  member("Palak Bhatla", "Sponsorships", "pr-outreach", "images/team/pr/palak.png"),
  member("Om Shukla", "Outreach", "pr-outreach", "images/team/pr/om.jpg"),
  member("Ayusman Choudhury", "Sponsorships", "pr-outreach", "images/team/pr/ayushman.jpg"),
  lead("Nimisha Tailor", "Social Media Lead", "social-media", "images/team/social/nimisha.jpg"),
  member("Shivi Sanjay", "Content Writer", "social-media", "images/team/social/shivi.jpg"),
  member("Shambhavi Singh", "Reels & Video", "social-media", "images/team/social/shambhavi.jpg"),
  member("Saanvi Shukla", "Content Writer", "social-media", "images/team/social/saanvi.jpg"),
  member("Jatin Rathor", "Reels & Video", "social-media", "images/team/social/jatin.jpg"),
  member("Chandashi Gupta", "Content Writer", "social-media", "images/team/social/chandashi.jpg"),
  member("Bisanjeet Mohapatra", "Reels & Video", "social-media", "images/team/social/bisanjeet.jpg"),
  // The old site used an AI-generated stock portrait for this member; initials until a real photo is added.
  lead("Akanksha Tripathi", "Design Lead", "design", ""),
  member("Rishita Prajapati", "UI/UX", "design", "images/team/design/rishita.jpg"),
  member("Shreesh Upadhayay", "Graphics", "design", "images/team/design/shreesh.png"),
  member("Aditi Dubey", "UI/UX", "design", "images/team/design/aditi.jpg"),
  member("Deeksha Bhojwani", "UI/UX", "design", "images/team/design/deeksha.jpg"),
  member("Gaurav Jain", "UI/UX", "design", "images/team/design/gaurav.jpg"),
  lead("Shreya Gupta", "Marketing Lead", "marketing", "images/team/marketing/shreya.jpg"),
  member("Ansh Mittal", "Content Writing", "marketing", "images/team/marketing/ansh.jpg"),
  member("Aryan Kumar", "Social Media", "marketing", "images/team/marketing/aryan.jpg"),
  member("Aryan Vishwakarma", "Content Writing", "marketing", "images/team/marketing/aryanv.jpg"),
  member("Ashvin Dewangan", "Social Media", "marketing", "images/team/marketing/ashvin.png"),
  member("Lavanya", "Content Writing", "marketing", "images/team/marketing/lavanya.jpg"),
];

await db.teamTerm.updateMany({ data: { isCurrent: false } });
const term = await db.teamTerm.upsert({
  where: { startYear: 2025 },
  create: { label: "2025–26", startYear: 2025, isCurrent: true, isPublished: true },
  update: { label: "2025–26", isCurrent: true, isPublished: true },
});
await db.teamMember.deleteMany({ where: { termId: term.id } });
for (const [order, m] of TEAM.entries()) {
  let photoId: string | null = null;
  if (m.photo)
    try {
      photoId = await upload(m.photo, "TEAM", `Portrait of ${m.name}`, `${slugify(m.name)}.jpg`);
    } catch (error) {
      console.warn(`  no photo for ${m.name}: ${String(error)}`);
    }
  await db.teamMember.create({
    data: {
      termId: term.id,
      name: m.name,
      title: m.title,
      tier: m.tier,
      order,
      featured: m.featured ?? false,
      photoId,
      domainId: m.domain ? domainId[m.domain] : null,
      links: { linkedin: m.linkedin ?? "", github: "", instagram: "", website: "", x: "" },
    },
  });
}

// ─── Sponsor and events ───
console.log("Events and posters…");
const categoryId = async (name: string) => (await db.eventCategory.findFirst({ where: { name } }))?.id ?? null;
const existingAnakin = await db.sponsor.findFirst({ where: { name: "Anakin" } });
const anakinData = {
  name: "Anakin",
  website: "https://anakin.io/",
  description: "Extract structured data from any website with a single API call. Sponsored GeekXcelerate with API credits and merchandise.",
  tier: "POWERED_BY" as const,
  showOnSponsorsPage: true,
  isActive: true,
};
const anakin = existingAnakin ? await db.sponsor.update({ where: { id: existingAnakin.id }, data: anakinData }) : await db.sponsor.create({ data: anakinData });

type EventInput = Omit<Prisma.EventUncheckedCreateInput, "posterId"> & { poster: string };
async function upsertEvent({ poster, ...data }: EventInput) {
  const posterId = await upload(poster, "POSTER", `${data.title} poster`, `${data.slug}.png`);
  await db.event.deleteMany({ where: { slug: data.slug } });
  return db.event.create({ data: { ...data, posterId, lifecycle: "PUBLISHED", publishedAt: new Date(data.startAt as Date) } });
}

await upsertEvent({
  slug: "borderland-2026",
  title: "Borderland: Survive the Chaos",
  tagline: "40 minutes. Infinite pressure. One winning team. A live survival game of trust, betrayal and logic, with Advitya.",
  poster: "images/events/borderland.png",
  categoryId: await categoryId("Contest"),
  startAt: ist("2026-02-27", "10:00"),
  endAt: ist("2026-02-27", "15:00"),
  venue: "AB 1 - 303",
  mode: "OFFLINE",
  registrationMode: "EXTERNAL",
  externalRegistrationUrl: "https://forms.gle/EokRQhkqS3Q39myo7",
  eligibility: "Open to all VIT Bhopal students, in teams.",
  description: `<p><strong>Borderland: Survive the Chaos</strong> was a 40 to 45 minute live survival experience, presented by GFG VIT Bhopal and Advitya. Teams competed under constantly changing chaos rules while playing psychological and logical games to earn tokens.</p>
<h3>The three layers</h3>
<ul><li><strong>Chaos Room:</strong> unpredictable rules activate without warning, and penalties for breaking them escalate with every offence.</li><li><strong>Borderland games:</strong> Hearts test your emotions (trust, sacrifice, silent votes). Spades test your logic under pressure.</li><li><strong>Tokens:</strong> every team starts with 10. Win games to earn more, spend them to skip chaos rules. The most tokens at the end wins.</li></ul>
<h3>Game flow</h3>
<p>Chaos only, then the games unlock, then high-risk optional rounds, then the final token tally.</p>
<p>You don't win by strength. You win by trust, betrayal and adaptation.</p>`,
});

const geek = await upsertEvent({
  slug: "geekxcelerate-2026",
  title: "GeekXcelerate",
  tagline: "Think fast. Code smart. Win big. An 8-hour hackathon on decentralized and responsible digital futures.",
  poster: "posters/GeekXcelerate%20Poster%20Final.png",
  categoryId: await categoryId("Hackathon"),
  startAt: ist("2026-04-03", "09:00"),
  endAt: ist("2026-04-03", "18:00"),
  venue: "AB 1 Auditorium",
  mode: "OFFLINE",
  registrationMode: "EXTERNAL",
  externalRegistrationUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfzFUYuO3X1nRjk0iv5XKOXTkF1QRn5ERcglo8hBP53u9g5JQ/viewform",
  eligibility: "Teams of 4. Registration fee ₹200. Full-day OD for all participants.",
  description: `<p>An 8-hour structured hackathon focused on building real, usable products around one theme: <strong>decentralized and responsible digital futures</strong>. Systems where users have control, systems are accountable, and digital power is not centralized.</p>
<blockquote>The next generation of technology won't just be powerful. It will be accountable, decentralized and human-controlled.</blockquote>
<p>Every project had to answer three questions: who controls the system, how is trust ensured, and where does accountability lie?</p>
<h3>Tracks</h3>
<ul><li>AI governance and accountability</li><li>Decentralized systems (Web3)</li><li>Privacy-first architectures</li><li>AI and human control interfaces</li><li>Trust infrastructure</li><li>Digital governance systems</li></ul>
<h3>Event flow</h3>
<ul><li><strong>Idea and planning (2 hours):</strong> problem statement, users, competitor analysis, architecture and pitch deck, refined with mentors.</li><li><strong>Build (6 hours):</strong> working prototypes only, with a real backend, AI/ML, APIs, database or real-time features. A midway checkpoint for mentor feedback.</li><li><strong>Final presentation:</strong> a 4-minute pitch and 2 minutes of Q&amp;A.</li></ul>
<h3>Judging</h3>
<p>Technical depth 30%, product thinking 20%, execution 20%, problem understanding 15%, innovation 15%.</p>
<h3>Awards</h3>
<p>Best Product Thinking, Most Innovative Idea, Best Technical Implementation and Most Scalable Solution. Sponsor <a href="https://anakin.io/">Anakin</a> gave every participant API credits, with extra credits and merchandise for the top five teams.</p>`,
});
await db.eventSponsor.create({ data: { eventId: geek.id, sponsorId: anakin.id, type: "POWERED_BY", customLabel: "Sponsored by", order: 0 } });

// ─── Homepage ───
console.log("Homepage…");
const sections = homepageSectionsSchema.parse([
  {
    id: newSectionId(),
    enabled: true,
    type: "hero",
    content: {
      eyebrow: "GeeksforGeeks Student Chapter · VIT Bhopal",
      heading: "Where code meets community.",
      highlightedWord: "community",
      subheading: "The official GeeksforGeeks chapter at VIT Bhopal. We build projects, host hackathons and help each other become better engineers.",
      ctas: [
        { label: "Explore events", href: "/events", style: "primary" },
        { label: "Meet the team", href: "/team", style: "secondary" },
      ],
      backgroundVariant: "dots",
      terminalLines: [],
      showLogoTile: true,
      showSocials: true,
      imageId: null,
      secondaryImageId: null,
      showNextEvent: true,
    },
  },
  {
    id: newSectionId(),
    enabled: true,
    type: "marquee",
    content: { items: ["Competitive Programming", "Development", "AI & ML", "Open Source", "Hackathons", "Tech Talks", "Peer Learning", "Problem Solving"] },
  },
  {
    id: newSectionId(),
    enabled: true,
    type: "about",
    content: {
      heading: "A community driven by passion and purpose.",
      body: "We don't just write code; we solve problems. Since 2021 we have grown from five founding members into one of the most active technical communities at VIT Bhopal.\nWhether you are writing your first loop or your fiftieth side project, there is a place for you here.",
      imageId: null,
      activities: [
        {
          id: newSectionId(),
          icon: "trophy",
          title: "Competitive Programming",
          description: "Master algorithms and data structures, compete in global contests and sharpen your problem solving.",
        },
        { id: newSectionId(), icon: "code", title: "Development", description: "Full-stack applications that scale, from React frontends to robust Node.js backends." },
        { id: newSectionId(), icon: "lightbulb", title: "AI & Machine Learning", description: "Neural networks, NLP and computer vision: training models that think." },
        { id: newSectionId(), icon: "branch", title: "Open Source", description: "Git, GitHub and community collaboration, contributing to the global code library." },
      ],
    },
  },
  { id: newSectionId(), enabled: true, type: "event_spotlight", content: { mode: "next_upcoming", eventId: null, showCountdown: true } },
  {
    id: newSectionId(),
    enabled: true,
    type: "stats",
    headingOverride: "The chapter so far",
    content: {
      items: [
        { id: newSectionId(), label: "Active members", value: 500, suffix: "+", source: "manual" },
        { id: newSectionId(), label: "Events organised", value: 25, suffix: "+", source: "manual" },
        { id: newSectionId(), label: "Projects built", value: 40, suffix: "+", source: "manual" },
        { id: newSectionId(), label: "Hackathon wins", value: 15, suffix: "+", source: "manual" },
      ],
    },
  },
  { id: newSectionId(), enabled: true, type: "announcements", content: { maxItems: 3 } },
  { id: newSectionId(), enabled: true, type: "gallery_highlights", content: { mode: "latest", albumId: null, maxItems: 5 } },
  { id: newSectionId(), enabled: true, type: "featured_team", headingOverride: "The people behind it", content: { maxItems: 4 } },
  {
    id: newSectionId(),
    enabled: true,
    type: "achievements",
    headingOverride: "Our journey",
    content: {
      items: [
        {
          id: newSectionId(),
          year: 2026,
          title: "GeekXcelerate and Borderland",
          description: "An 8-hour product hackathon sponsored by Anakin, and a live survival game with Advitya.",
          imageId: null,
        },
        { id: newSectionId(), year: 2022, title: "500 members", description: "Crossed 500 active community members and launched mentorship tracks.", imageId: null },
        { id: newSectionId(), year: 2022, title: "CodeWar 1.0", description: "Our first hackathon drew 300+ registrations from across India.", imageId: null },
        { id: newSectionId(), year: 2021, title: "Chapter founded", description: "Five core members set out to change the coding culture at VIT Bhopal.", imageId: null },
      ],
    },
  },
  { id: newSectionId(), enabled: true, type: "sponsors", headingOverride: "Supported by", content: { tierFilter: [] } },
  {
    id: newSectionId(),
    enabled: true,
    type: "cta",
    content: {
      heading: "Ready to debug your career?",
      subheading: "Join a community of passionate developers. Whether you are a beginner or a pro, there is a place for you here.",
      ctas: [
        { label: "Get in touch", href: "/contact", style: "primary" },
        { label: "See our events", href: "/events", style: "secondary" },
      ],
      backgroundVariant: "gradient",
    },
  },
]) as unknown as Prisma.InputJsonValue;

await db.$transaction(async (tx) => {
  await tx.homepageRevision.updateMany({ where: { status: "PUBLISHED" }, data: { status: "SUPERSEDED" } });
  await tx.homepageRevision.create({ data: { status: "PUBLISHED", sections, publishedAt: new Date() } });
  const draft = await tx.homepageRevision.findFirst({ where: { status: "DRAFT" } });
  if (draft) await tx.homepageRevision.update({ where: { id: draft.id }, data: { sections } });
  else await tx.homepageRevision.create({ data: { status: "DRAFT", sections } });
});

await db.$disconnect();
console.log(`Imported ${TEAM.length} team members, 2 events and the homepage. Restart the app (and clear .next/dev/cache/fetch-cache in dev) to see it.`);
