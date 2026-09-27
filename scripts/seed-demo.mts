/**
 * Demo content for previewing the site design: events, team, albums, announcements and a published
 * homepage built from the recommended template. Placeholder photos come from picsum.photos (seeded,
 * so reruns look the same) and fall back to generated gradients when offline.
 *
 *   npm run seed:demo            # dev only
 *   npm run seed:demo -- --force # allow when NODE_ENV=production
 *
 * Every demo row uses a `demo-` slug (uploads: a `demo-` file name), so a rerun replaces the previous
 * demo data instead of duplicating it. Real content is never touched.
 */
import "dotenv/config";
import sharp from "sharp";
import type { Prisma } from "../src/generated/prisma/client";
import { db } from "../src/lib/db";
import { registrationForm } from "../src/lib/forms/engine/test-fixtures";
import { homepageTemplate } from "../src/lib/homepage/template";
import type { ImagePurpose } from "../src/lib/media/variants";
import { deleteUploadFiles, saveImage } from "../src/server/media/save-image";

if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to seed demo content with NODE_ENV=production. Pass --force if you really mean it.");
  process.exit(1);
}

const DAY = 86_400_000;
const now = Date.now();
/** A date `days` from today at `hour`:00 India time. */
const at = (days: number, hour: number) => {
  const d = new Date(now + days * DAY);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + (hour * 60 - 330) * 60_000); // IST is UTC+5:30
};

let failures = 0;
async function photo(seed: string, width: number, height: number): Promise<Buffer> {
  // picsum is occasionally slow; retry each photo, and give up on it after 3 photos in a row fail.
  for (let attempt = 0; failures < 3 && attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://picsum.photos/seed/gfg-${seed}/${width}/${height}`, { signal: AbortSignal.timeout(30_000) });
      if (res.ok) {
        failures = 0;
        return Buffer.from(await res.arrayBuffer());
      }
    } catch {
      /* retry */
    }
  }
  if (++failures === 3) console.warn("picsum.photos unreachable; using generated gradient placeholders.");
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><radialGradient id="g" cx="30%" cy="25%" r="90%"><stop offset="0" stop-color="hsl(${140 + (h % 30)},45%,38%)"/><stop offset="1" stop-color="hsl(${150 + (h % 20)},40%,9%)"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

async function upload(seed: string, purpose: ImagePurpose, width: number, height: number, alt: string): Promise<string> {
  const row = await saveImage({ buffer: await photo(seed, width, height), originalName: `demo-${seed}.jpg`, purpose, alt, uploadedById: null });
  return row.id;
}

// ─── Clear the previous demo run ───
const oldUploads = await db.upload.findMany({ where: { originalName: { startsWith: "demo-" } }, select: { id: true, storageKey: true, visibility: true } });
await db.event.deleteMany({ where: { slug: { startsWith: "demo-" } } });
await db.galleryAlbum.deleteMany({ where: { slug: { startsWith: "demo-" } } });
await db.announcement.deleteMany({ where: { slug: { startsWith: "demo-" } } });
await db.form.deleteMany({ where: { slug: { startsWith: "demo-" } } });
await db.upload.deleteMany({ where: { id: { in: oldUploads.map((u) => u.id) } } });
for (const u of oldUploads) await deleteUploadFiles(u);

// ─── Site settings ───
const settings = await db.siteSettings.findUniqueOrThrow({ where: { id: 1 } });
await db.siteSettings.update({
  where: { id: 1 },
  data: {
    clubName: "GFG Student Chapter, VIT Bhopal",
    shortName: "GFG VIT Bhopal",
    universityName: "VIT Bhopal University",
    tagline: "Learn, build and share with the GeeksforGeeks Student Chapter at VIT Bhopal.",
    // Placeholder addresses read as broken on a live site; the footer hides an empty email.
    ...(/@example\./.test(settings.email) ? { email: "" } : {}),
    seo: { ...(settings.seo as Record<string, unknown>), titleTemplate: "%s · GFG VIT Bhopal" },
  },
});

// ─── Registration form + events ───
console.log("Fetching demo photos…");
const definition = registrationForm() as unknown as Prisma.InputJsonValue;
const form = await db.form.create({ data: { name: "Demo: CodeSprint registration", slug: "demo-codesprint-registration", draftDefinition: definition } });
const version = await db.formVersion.create({ data: { formId: form.id, version: 1, definition } });
await db.form.update({ where: { id: form.id }, data: { publishedVersionId: version.id, hasUnpublishedChanges: false } });

const categories = await db.eventCategory.findMany({ orderBy: { order: "asc" } });
const category = (name: string) => categories.find((c) => c.name.toLowerCase().includes(name))?.id ?? categories[0]?.id ?? null;

const upcoming = await db.event.create({
  data: {
    slug: "demo-codesprint-2026",
    title: "CodeSprint 2026",
    tagline: "A 6-hour team contest with problems written by seniors. Pizza included.",
    description: "Teams of up to three solve eight problems across DSA, greedy and graphs.\n\nBeginners welcome: the first three problems are warm-ups.",
    posterId: await upload("codesprint", "POSTER", 1600, 900, "Demo photo: students at laptops"),
    categoryId: category("contest"),
    startAt: at(12, 10),
    endAt: at(12, 16),
    venue: "AB-1, Seminar Hall 2",
    mode: "OFFLINE",
    registrationDeadline: at(11, 23),
    maxParticipants: 150,
    lifecycle: "PUBLISHED",
    publishedAt: new Date(now - 3 * DAY),
    registrationMode: "FORM",
    formId: form.id,
    showCountdown: true,
    featured: true,
  },
});
const pastA = await db.event.create({
  data: {
    slug: "demo-web-dev-bootcamp",
    title: "Web Dev Bootcamp",
    tagline: "Two evenings from HTML to a deployed Next.js app.",
    description: "Hands-on sessions covering layout, React basics and deploying your first project.",
    posterId: await upload("bootcamp", "POSTER", 1600, 900, "Demo photo: a workshop in progress"),
    categoryId: category("workshop"),
    startAt: at(-28, 17),
    endAt: at(-27, 20),
    venue: "Lab Complex, Lab 4",
    lifecycle: "PUBLISHED",
    publishedAt: new Date(now - 45 * DAY),
  },
});
const pastB = await db.event.create({
  data: {
    slug: "demo-open-source-day",
    title: "Open Source Day",
    tagline: "First pull requests, reviewed live by maintainers.",
    description: "An afternoon of picking good-first-issues and landing real contributions.",
    posterId: await upload("opensource", "POSTER", 1600, 900, "Demo photo: a group around a screen"),
    categoryId: category("talk"),
    startAt: at(-74, 14),
    endAt: at(-74, 18),
    mode: "HYBRID",
    venue: "Central Library Auditorium",
    onlineUrl: "https://example.com/demo-stream",
    lifecycle: "PUBLISHED",
    publishedAt: new Date(now - 90 * DAY),
  },
});

// ─── Team ───
const year = new Date(now).getFullYear();
await db.teamTerm.updateMany({ data: { isCurrent: false } });
const term = await db.teamTerm.upsert({
  where: { startYear: year },
  create: { label: `${year}–${String(year + 1).slice(2)}`, startYear: year, isCurrent: true, isPublished: true },
  update: { isCurrent: true, isPublished: true },
});
const DEMO_TEAM = [
  { name: "Aarav Mehta", title: "Chapter Lead", tier: "LEAD" },
  { name: "Ishita Rao", title: "Vice Lead", tier: "LEAD" },
  { name: "Kabir Singh", title: "Technical Head", tier: "CORE" },
  { name: "Ananya Iyer", title: "Events Head", tier: "CORE" },
  { name: "Rohan Das", title: "Design Head", tier: "CORE" },
  { name: "Meera Kulkarni", title: "Outreach Head", tier: "CORE" },
  { name: "Vihaan Joshi", title: "DSA Lead", tier: "DOMAIN_LEAD" },
  { name: "Sara Khan", title: "Web Lead", tier: "DOMAIN_LEAD" },
] as const;
await db.teamMember.deleteMany({ where: { termId: term.id, name: { in: DEMO_TEAM.map((m) => m.name) } } });
const domains = await db.domain.findMany({ orderBy: { order: "asc" } });
for (const [i, m] of DEMO_TEAM.entries()) {
  await db.teamMember.create({
    data: {
      termId: term.id,
      name: m.name,
      title: m.title,
      tier: m.tier,
      order: i,
      featured: i < 4,
      // The last member has no photo on purpose, to show the initials fallback.
      photoId: i === DEMO_TEAM.length - 1 ? null : await upload(`team-${i}`, "TEAM", 800, 800, `Demo portrait of ${m.name}`),
      domainId: m.tier === "DOMAIN_LEAD" ? (domains[i % Math.max(domains.length, 1)]?.id ?? null) : null,
      links: { linkedin: "https://www.linkedin.com/", github: "https://github.com/", instagram: "", website: "", x: "" },
    },
  });
}

// ─── Gallery ───
async function album(slug: string, title: string, eventId: string, date: Date, count: number) {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const portrait = i % 3 === 1;
    ids.push(await upload(`${slug}-${i}`, "GALLERY", portrait ? 1200 : 1800, portrait ? 1600 : 1200, `Demo photo ${i + 1} from ${title}`));
  }
  await db.galleryAlbum.create({
    data: {
      slug: `demo-${slug}`,
      title,
      date,
      eventId,
      coverId: ids[0],
      isPublished: true,
      images: { create: ids.map((uploadId, order) => ({ uploadId, order })) },
    },
  });
}
await album("open-source-day", "Open Source Day", pastB.id, pastB.startAt, 6);
await album("web-dev-bootcamp", "Web Dev Bootcamp", pastA.id, pastA.startAt, 7);

// ─── Announcements ───
const ANNOUNCEMENTS = [
  { slug: "demo-codesprint-registrations-open", title: "CodeSprint 2026 registrations are open", summary: "Teams of up to three. Seats are limited to 150.", daysAgo: 2, priority: "URGENT", linkUrl: `/events/${upcoming.slug}` },
  { slug: "demo-bootcamp-recordings", title: "Web Dev Bootcamp slides and recordings", summary: "Everything from both evenings, in one place.", daysAgo: 20, priority: "NORMAL" },
  { slug: "demo-core-team-applications", title: "Core team applications close Friday", summary: "Design, events and outreach roles are open to all years.", daysAgo: 35, priority: "IMPORTANT" },
] as const;
for (const a of ANNOUNCEMENTS) {
  await db.announcement.create({
    data: {
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      content: `${a.summary}\n\nThis is demo content. Replace it from the admin panel.`,
      status: "PUBLISHED",
      publishAt: new Date(now - a.daysAgo * DAY),
      priority: a.priority,
      showOnHomepage: true,
      linkUrl: "linkUrl" in a ? a.linkUrl : null,
      linkLabel: "linkUrl" in a ? "Register" : null,
    },
  });
}

// ─── Homepage: publish the template, and mirror it into the draft so the builder shows it ───
const sections = homepageTemplate({
  heroImageId: await upload("hero-main", "GALLERY", 1200, 1500, "Demo photo: students collaborating"),
  heroSecondaryImageId: await upload("hero-second", "GALLERY", 900, 900, "Demo photo: a laptop with code"),
  aboutImageId: await upload("about", "GALLERY", 1200, 1500, "Demo photo: a chapter session"),
  milestones: [
    { year: year, title: "First 6-hour CodeSprint", description: "150 seats for the chapter's biggest contest yet.", imageId: null },
    { year: year - 1, title: "Open Source Day", description: "Dozens of first pull requests merged in one afternoon.", imageId: null },
    { year: year - 2, title: "Chapter founded", description: "A handful of students, one classroom, and a plan for weekly sessions.", imageId: null },
  ],
}) as unknown as Prisma.InputJsonValue;
await db.$transaction(async (tx) => {
  await tx.homepageRevision.updateMany({ where: { status: "PUBLISHED" }, data: { status: "SUPERSEDED" } });
  await tx.homepageRevision.create({ data: { status: "PUBLISHED", sections, publishedAt: new Date() } });
  const draft = await tx.homepageRevision.findFirst({ where: { status: "DRAFT" } });
  if (draft) await tx.homepageRevision.update({ where: { id: draft.id }, data: { sections } });
  else await tx.homepageRevision.create({ data: { status: "DRAFT", sections } });
});

await db.$disconnect();
console.log("Demo content ready. If `next dev` is running, restart it after: rm -rf .next/dev/cache/fetch-cache");
