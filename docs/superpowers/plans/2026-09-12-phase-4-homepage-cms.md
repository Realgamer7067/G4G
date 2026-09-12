# Phase 4: Homepage CMS + About/Contact Editors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins compose the public homepage from an ordered list of toggleable sections (11 types), with autosaved drafts, a live preview, publish/history, and audit logging — then extend the same "real public page + admin editor" pattern to the About and Contact pages so `IMPLEMENTED_PAGES` covers all pages that have public value.

**Architecture:** A pure Zod-schema + ops module (`src/lib/homepage/sections/`) defines the 11 section-content shapes and CRUD/reorder operations, unit-tested with no DB dependency — mirroring `src/lib/forms/builder/ops.ts`. A single `HomepageRevision` row with `status: "DRAFT"` holds the editable sections array at all times; `status: "PUBLISHED"`/`"SUPERSEDED"` rows are immutable history snapshots, published/restored via server actions that reuse the project's `runAction`/`writeAuditLog`/`invalidate` conventions. The admin editor is a client component reusing the exact serialized-autosave state machine from `form-builder.tsx`, with dnd-kit for section reordering. The public homepage and a standalone (non-admin-shell) preview route both render the same `sections` array through one dispatcher component. About/Contact reuse the existing (already-seeded) `PageSetting.content` JSON field and `pages.manage` permission.

**Tech Stack:** Next.js 16 App Router, Zod, Prisma 7 (`HomepageRevision`, `PageSetting` — both models already exist, **no migration needed**), `@dnd-kit/core@6.3.1` + `@dnd-kit/sortable@10.0.0` + `@dnd-kit/utilities@3.2.2` (already in `package.json`, but see Task 0 — not currently resolvable in `node_modules`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-gfg-chapter-platform-design.md` §8 (Homepage CMS) and the "Homepage CMS & static pages" line in §"Phases". Executors should read §8 in full before starting; the exact text is reproduced under Global Constraints below since it's short.

## Global Constraints

- Spec §8 verbatim: "`HomepageRevision.sections` = ordered array of `{ id, type, enabled, content }`, each `content` validated by a per-type Zod schema. Section types: `hero`, `about`, `stats`, `event_spotlight`, `announcements`, `achievements`, `featured_team`, `gallery_highlights`, `sponsors`, `social`, `cta`. (Footer is global, edited in Settings.)" Field lists for `hero`, `stats`, `event_spotlight`, `announcements`, `featured_team`, `gallery_highlights`, `sponsors`, `achievements` are given explicitly (reproduced per-task below); `about`, `social`, and `cta` are named as types but not detailed — Task 1 documents the exact judgment call made for each.
- Spec §8 verbatim: "Editor: sortable section list (dnd-kit) with enable toggles, per-type form in a side panel, live preview iframe (`/admin/homepage/preview`, auth + `homepage.edit`) reloading on save. **Publish** (`homepage.publish`) copies draft to a new PUBLISHED revision. History lists past revisions with 'Restore to draft'. Audit logged."
- Permissions `homepage.edit`, `homepage.publish`, and `pages.manage` already exist in `src/lib/rbac/permissions.ts` — do not add new permission keys.
- `HomepageRevision` and `PageSetting` (with its `content Json` field) already exist in `prisma/schema.prisma` — **no `prisma migrate` step anywhere in this plan.**
- Every server action must go through `runAction`/`ActionResult` (`src/lib/actions.ts`), use `requirePermission` (actions) or `requirePagePermission` (pages) from `src/lib/auth/guard.ts`, write an audit entry via `writeAuditLog` (`src/lib/audit.ts`) inside the same transaction as the data change, and call `invalidate(...)` (`src/lib/cache-tags.ts`) with every affected tag after the transaction commits — this is the exact pattern used by every existing action in `src/server/actions/forms.ts` and `src/server/actions/pages.ts`.
- Pure logic modules (schema, ops, factories) must not import `@/lib/db` or any other `server-only` module, so they stay unit-testable without `DATABASE_URL` — this was a hard-won lesson from Phase 3 (`src/server/forms/files.ts` had to be split for exactly this reason; see `src/lib/forms/clean-name.ts`).
- Follow the existing `zod` + `z.discriminatedUnion` style from `src/lib/forms/engine/schema.ts` exactly (discriminant field, `z.infer`/`Extract` for types, one object per branch).
- Reuse existing components/data instead of inventing new ones: `EventCard` + `EventCardDTO` + `getPublicEvents` (`src/lib/data/events.ts`), `Countdown` (`src/components/events/countdown.tsx`), `getPublicSponsors` + `SPONSOR_TIER_LABELS`, `socialLinks` + `SocialIcon` (`src/components/site/social-icons.tsx`), `Picture` + `PublicImage` + `toPublicImage` + `publicImageSelect` + `imageUrl` (`src/lib/media/public-image.ts`), `Spotlight` (`src/components/site/spotlight.tsx`), `Rings` (`src/components/site/rings.tsx`).
- Admin form primitives to reuse for About/Contact (already used by `settings-form.tsx`): `useFormAction`, `fieldErrorFor`, `SaveBar` (`src/components/admin/form-state.tsx`), `Field`, `describedBy` (`src/components/ui/field.tsx`), `Input`, `Textarea`, `Panel` (`src/components/admin/page-header.tsx`), `formDataToObject` (`src/lib/forms-data.ts`).

---

## File Structure

```
src/lib/homepage/sections/
  schema.ts        # Zod schemas for all 11 section types + HomepageSections array schema (pure, no db import)
  meta.ts          # SECTION_TYPES list + label/description per type (pure, used by both admin UI and tests)
  factories.ts      # blankSection(type) — a valid empty section per type, plus newSectionId()
  ops.ts           # addSection / removeSection / moveSection / toggleSection / updateSection (pure)
  ops.test.ts       # unit tests for every ops.ts function

src/lib/data/homepage.ts   # loadDraftHomepage (get-or-create), getPublishedHomepage (cached), loadHomepageHistory
src/server/actions/homepage.ts   # saveHomepageDraftAction, publishHomepageAction, restoreHomepageRevisionAction

src/components/homepage/section-renderer.tsx   # dispatches one Section to the right renderer by `type`
src/components/homepage/sections/
  hero.tsx  stats.tsx  event-spotlight.tsx  cta.tsx           # Task Group C (vertical slice)
  about.tsx  achievements.tsx  social.tsx                     # Task 11 (static/settings-driven)
  announcements.tsx  featured-team.tsx  gallery-highlights.tsx  sponsors.tsx   # Task 12 (DB-query-driven)

src/app/admin/(panel)/homepage/
  page.tsx                  # server component: permission gate, loads draft, resolves images
  homepage-builder.tsx        # client orchestrator: autosave state machine, section list, inspector, preview iframe
  section-list.tsx           # dnd-kit sortable list + enable toggles + add/remove
  inspector.tsx              # dispatches the selected section to its form
  section-forms/
    hero.tsx  stats.tsx  event-spotlight.tsx  cta.tsx
    about.tsx  achievements.tsx  social.tsx
    announcements.tsx  featured-team.tsx  gallery-highlights.tsx  sponsors.tsx
  history.tsx                # publish history list + "Restore to draft"

src/app/admin/homepage/preview/page.tsx    # OUTSIDE the (panel) route group — see Task 13

src/app/(site)/page.tsx      # MODIFIED: renders getPublishedHomepage() sections through section-renderer
src/app/(site)/about/page.tsx    # NEW
src/app/(site)/contact/page.tsx  # NEW

src/lib/pages/about-schema.ts     # Zod schema for PageSetting.content when key=ABOUT
src/lib/pages/contact-schema.ts   # Zod schema for PageSetting.content when key=CONTACT
src/server/actions/page-content.ts  # saveAboutContentAction, saveContactContentAction
src/app/admin/(panel)/pages/about/page.tsx     # NEW admin editor
src/app/admin/(panel)/pages/about/about-form.tsx
src/app/admin/(panel)/pages/contact/page.tsx   # NEW admin editor
src/app/admin/(panel)/pages/contact/contact-form.tsx
src/app/admin/(panel)/pages/pages-editor.tsx   # MODIFIED: link to the two editors above
src/lib/pages/registry.ts   # MODIFIED: IMPLEMENTED_PAGES gains ABOUT, CONTACT
src/components/admin/quick-actions.ts   # MODIFIED: "Edit homepage" shortcut
```

**Why this layout:** `sections/` mirrors `forms/builder/` exactly (schema + ops + factories + tests as one small pure package). Per-type renderer/form files are split one-per-file (11 types is too many to keep readable in one file the way `forms/builder/inspector.tsx` held 2 block kinds). `about-schema.ts`/`contact-schema.ts` live under `lib/pages/` (next to `registry.ts`) rather than under `lib/homepage/` since they're unrelated to the homepage sections feature — they configure the pre-existing `PageSetting.content` field for two specific pages.

---

### Task 0: Fix the `@dnd-kit` install

**Files:** none (environment only)

**Interfaces:** N/A

`@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2` are listed in `package.json` but are **not currently resolvable** — verified with:

```bash
node -e "require.resolve('@dnd-kit/core')"
```

This throws `Cannot find module '@dnd-kit/core'`. Only `node_modules/.pnpm/@dnd-kit+core@6.3.1_.../node_modules/@dnd-kit/core` exists (nested inside a stray pnpm store); there is no top-level `node_modules/@dnd-kit/core`, `.../sortable`, or `.../utilities` — only `@dnd-kit/accessibility` (a transitive dependency) got hoisted. This project uses npm (`package-lock.json`), so the `.pnpm` directory is leftover from an earlier `pnpm install` and the packages were never actually installed by npm.

- [ ] **Step 1: Reinstall dependencies**

```bash
rm -rf node_modules/.pnpm
npm install
```

- [ ] **Step 2: Verify all three packages resolve**

```bash
node -e "require.resolve('@dnd-kit/core'); require.resolve('@dnd-kit/sortable'); require.resolve('@dnd-kit/utilities'); console.log('ok')"
```

Expected: prints `ok` with no error. If it still fails, do not proceed to Task 9 (dnd-kit is only needed there) — fall back to the up/down-arrow reorder pattern from `src/lib/forms/builder/ops.ts`'s `movePage`/`swap` instead, and note the deviation when reporting.

- [ ] **Step 3: Confirm nothing else broke**

```bash
npm run lint && npm run typecheck
```

Expected: same pass/fail state as before this step (a full `npm install` can occasionally shift transitive versions — if new errors appear here, stop and investigate before continuing, this is a pre-existing-tree bug fix, not part of the feature work).

No commit for this task alone — the `package-lock.json` diff (if any) will be committed together with Task 9, since Task 9 is the first task that actually uses the packages.

---

### Task 1: Section content schemas

**Files:**
- Create: `src/lib/homepage/sections/schema.ts`
- Test: `src/lib/homepage/sections/schema.test.ts`

**Interfaces:**
- Produces: `type SectionType = "hero" | "about" | "stats" | "event_spotlight" | "announcements" | "achievements" | "featured_team" | "gallery_highlights" | "sponsors" | "social" | "cta"`; `type Section` (discriminated union on `type`, every branch also carrying `id: string`, `enabled: boolean`, `anchorId?: string`, `headingOverride?: string`, `subheadingOverride?: string`, `content: <per-type content type>`); `type HomepageSections = Section[]`; `homepageSectionsSchema: z.ZodType<HomepageSections>`; `sectionSchema` (single-section schema, exported for factories/tests); per-type content types: `HeroContent`, `AboutContent`, `StatsContent`, `EventSpotlightContent`, `AnnouncementsContent`, `AchievementsContent`, `FeaturedTeamContent`, `GalleryHighlightsContent`, `SponsorsContent`, `SocialContent`, `CtaContent`.

**Judgment calls (spec §8 only names `about`, `social`, `cta` as types without detailing fields):**
- `about`: a short homepage blurb distinct from the full About *page* — `heading`, `body` (plain text, one paragraph per line — matches how `Announcement.content` and `Event.description` already store prose as plain strings, no rich-text infra exists in this codebase), optional `imageId`.
- `social`: spec already gives `SiteSettings.socials` as the single source of truth for URLs (`instagram, linkedin, github, youtube, discord, whatsapp, x, custom[]`) — this section has no URLs of its own, only a `style: "icons" | "buttons"` display toggle. The renderer pulls live data from `getSiteSettings()`.
- `cta`: a full-width banner distinct from `hero`'s inline CTAs — `eyebrow?`, `heading`, `subheading?`, `ctas` (1–2, same shape as hero's), `backgroundVariant: "solid" | "gradient" | "outline"`.
- `stats` "auto" sources (`events_completed`, `team_members`, `gallery_photos`) are computed server-side at render time (Task 6/Task 8), not stored — the schema only stores which source each item uses.
- `featured_team` and `gallery_highlights` add a `maxItems` cap (spec doesn't specify one) purely for layout sanity, same idea as `announcements`' existing `maxItems`.

- [ ] **Step 1: Write the schema**

```ts
// src/lib/homepage/sections/schema.ts
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
  backgroundVariant: z.enum(["rings", "grid", "glow"]).default("rings"),
  terminalLines: z.array(z.string().trim().max(80)).max(6).default([]),
  showLogoTile: z.boolean().default(true),
  showSocials: z.boolean().default(false),
});
export type HeroContent = z.infer<typeof heroContentSchema>;

export const aboutContentSchema = z.object({
  heading: optionalText(80),
  body: z.string().trim().max(2000).default(""),
  imageId: z.string().nullable().default(null),
});
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
]);
export type Section = z.infer<typeof sectionSchema>;

export const homepageSectionsSchema = z.array(sectionSchema).max(40);
export type HomepageSections = z.infer<typeof homepageSectionsSchema>;

export type SectionOfType<T extends SectionType> = Extract<Section, { type: T }>;
```

- [ ] **Step 2: Write the failing test, then the schema above makes it pass**

```ts
// src/lib/homepage/sections/schema.test.ts
import { describe, expect, it } from "vitest";
import { homepageSectionsSchema, sectionSchema } from "./schema";

describe("sectionSchema", () => {
  it("accepts a minimal valid hero section", () => {
    const result = sectionSchema.safeParse({
      id: "sec_1",
      type: "hero",
      enabled: true,
      content: { heading: "Build with us" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a hero section with no heading", () => {
    const result = sectionSchema.safeParse({ id: "sec_1", type: "hero", enabled: true, content: {} });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown section type", () => {
    const result = sectionSchema.safeParse({ id: "sec_1", type: "banner", enabled: true, content: {} });
    expect(result.success).toBe(false);
  });

  it("rejects more than 2 CTAs on a hero section", () => {
    const cta = { label: "Go", href: "/x", style: "primary" as const };
    const result = sectionSchema.safeParse({
      id: "sec_1",
      type: "hero",
      enabled: true,
      content: { heading: "H", ctas: [cta, cta, cta] },
    });
    expect(result.success).toBe(false);
  });

  it("caps the whole sections array at 40 entries", () => {
    const one = { id: "sec_1", type: "social" as const, enabled: true, content: {} };
    const result = homepageSectionsSchema.safeParse(Array.from({ length: 41 }, () => one));
    expect(result.success).toBe(false);
  });

  it("parses a full realistic sections array", () => {
    const result = homepageSectionsSchema.safeParse([
      { id: "sec_1", type: "hero", enabled: true, content: { heading: "Build with us", ctas: [{ label: "Join", href: "/join", style: "primary" }] } },
      { id: "sec_2", type: "stats", enabled: true, content: { items: [{ id: "st_1", label: "Events", value: null, source: "events_completed" }] } },
      { id: "sec_3", type: "cta", enabled: false, content: { heading: "Ready?", ctas: [{ label: "Apply", href: "/apply", style: "primary" }] } },
    ]);
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npx vitest run src/lib/homepage/sections/schema.test.ts
```

Expected: all 6 pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/homepage/sections/schema.ts src/lib/homepage/sections/schema.test.ts
git commit -m "feat(homepage): add section content schemas for all 11 types"
```

---

### Task 2: Section metadata + factories

**Files:**
- Create: `src/lib/homepage/sections/meta.ts`
- Create: `src/lib/homepage/sections/factories.ts`
- Test: `src/lib/homepage/sections/factories.test.ts`

**Interfaces:**
- Consumes: `SECTION_TYPES`, `Section`, `SectionType` from `./schema` (Task 1).
- Produces: `SECTION_META: Record<SectionType, { label: string; description: string }>`; `blankSection(type: SectionType): Section`; `newSectionId(): string`.

- [ ] **Step 1: Write `meta.ts`**

```ts
// src/lib/homepage/sections/meta.ts
import type { SectionType } from "./schema";

export const SECTION_META: Record<SectionType, { label: string; description: string }> = {
  hero: { label: "Hero", description: "Big heading, subheading and call-to-action buttons at the top of the page." },
  about: { label: "About blurb", description: "A short paragraph introducing the chapter, with an optional photo." },
  stats: { label: "Stats", description: "A row of numbers — events run, team size, photos — manual or auto-computed." },
  event_spotlight: { label: "Event spotlight", description: "Highlights the next upcoming event or one you pin, with a countdown." },
  announcements: { label: "Announcements", description: "Recent announcements flagged to show on the homepage." },
  achievements: { label: "Achievements", description: "A timeline or grid of awards and milestones." },
  featured_team: { label: "Featured team", description: "Members marked \"featured\" from the current team." },
  gallery_highlights: { label: "Gallery highlights", description: "Recent or hand-picked photos from an album." },
  sponsors: { label: "Sponsors", description: "Sponsor logos, optionally filtered to specific tiers." },
  social: { label: "Social links", description: "Icons or buttons linking to the chapter's social accounts." },
  cta: { label: "Call to action", description: "A full-width banner with a heading and one or two buttons." },
};
```

- [ ] **Step 2: Write `factories.ts`**

```ts
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
      return { ...base, type, content: { heading: "New heading", ctas: [], backgroundVariant: "rings", terminalLines: [], showLogoTile: true, showSocials: false } };
    case "about":
      return { ...base, type, content: { body: "", imageId: null } };
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
  }
}
```

- [ ] **Step 3: Write the test**

```ts
// src/lib/homepage/sections/factories.test.ts
import { describe, expect, it } from "vitest";
import { blankSection, newSectionId } from "./factories";
import { SECTION_TYPES } from "./schema";
import { sectionSchema } from "./schema";

describe("blankSection", () => {
  for (const type of SECTION_TYPES) {
    it(`produces a schema-valid ${type} section`, () => {
      expect(sectionSchema.safeParse(blankSection(type)).success).toBe(true);
    });
  }

  it("gives every blank section a unique id", () => {
    const ids = new Set(SECTION_TYPES.map((t) => blankSection(t).id));
    expect(ids.size).toBe(SECTION_TYPES.length);
  });
});

describe("newSectionId", () => {
  it("is prefixed and reasonably unique", () => {
    const a = newSectionId();
    const b = newSectionId();
    expect(a).toMatch(/^sec_/);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 4: Run tests, then commit**

```bash
npx vitest run src/lib/homepage/sections
git add src/lib/homepage/sections/meta.ts src/lib/homepage/sections/factories.ts src/lib/homepage/sections/factories.test.ts
git commit -m "feat(homepage): add section metadata and blank-section factories"
```

---

### Task 3: Section ops (add/remove/move/toggle/update)

**Files:**
- Create: `src/lib/homepage/sections/ops.ts`
- Test: `src/lib/homepage/sections/ops.test.ts`

**Interfaces:**
- Consumes: `HomepageSections`, `Section` from `./schema` (Task 1).
- Produces: `addSection(sections, section, afterId?)`, `removeSection(sections, id)`, `moveSection(sections, id, dir)`, `toggleSection(sections, id)`, `updateSection(sections, id, patch)` — each `(sections: HomepageSections, ...) => HomepageSections`, all pure (no mutation of the input array).

- [ ] **Step 1: Write `ops.ts`**

```ts
// src/lib/homepage/sections/ops.ts
import type { HomepageSections, Section } from "./schema";

function swap(arr: readonly Section[], i: number, j: number): Section[] {
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return [...arr];
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function addSection(sections: HomepageSections, section: Section, afterId: string | null = null): HomepageSections {
  const next = [...sections];
  const at = afterId ? next.findIndex((s) => s.id === afterId) : next.length - 1;
  next.splice(at + 1, 0, section);
  return next;
}

export function removeSection(sections: HomepageSections, id: string): HomepageSections {
  return sections.filter((s) => s.id !== id);
}

export function moveSection(sections: HomepageSections, id: string, dir: -1 | 1): HomepageSections {
  const idx = sections.findIndex((s) => s.id === id);
  if (idx === -1) return sections;
  return swap(sections, idx, idx + dir);
}

/** Reorders to an arbitrary new index — used by the dnd-kit drop handler, which already knows both indexes. */
export function reorderSections(sections: HomepageSections, fromIndex: number, toIndex: number): HomepageSections {
  if (fromIndex < 0 || fromIndex >= sections.length || toIndex < 0 || toIndex >= sections.length) return sections;
  const next = [...sections];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function toggleSection(sections: HomepageSections, id: string): HomepageSections {
  return sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
}

/**
 * Merges a patch into one section: top-level fields (anchorId, overrides) replace; `content` shallow-merges.
 * Not generic over the section's specific type — matches `updateBlock` in `forms/builder/ops.ts`, which takes
 * `Partial<Block>` (the whole union) rather than a per-kind generic, for the same reason: callers already know
 * which branch they're on and pass a same-shaped literal, so a generic here would only fight type inference
 * (Omit/Pick over a discriminated union collapses `content` to the union of every branch's content type,
 * which doesn't help the caller and isn't worth the complexity).
 */
export function updateSection(sections: HomepageSections, id: string, patch: Partial<Omit<Section, "id" | "type">>): HomepageSections {
  return sections.map((s) => {
    if (s.id !== id) return s;
    const { content, ...rest } = patch as { content?: Record<string, unknown> } & Record<string, unknown>;
    return { ...s, ...rest, content: content ? { ...s.content, ...content } : s.content } as Section;
  });
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/homepage/sections/ops.test.ts
import { describe, expect, it } from "vitest";
import { blankSection } from "./factories";
import { addSection, moveSection, removeSection, reorderSections, toggleSection, updateSection } from "./ops";
import type { HomepageSections } from "./schema";

function fixture(): HomepageSections {
  return [
    { id: "a", type: "hero", enabled: true, content: { heading: "H", ctas: [], backgroundVariant: "rings", terminalLines: [], showLogoTile: true, showSocials: false } },
    { id: "b", type: "stats", enabled: true, content: { items: [] } },
    { id: "c", type: "cta", enabled: false, content: { heading: "C", ctas: [{ label: "Go", href: "/x", style: "primary" }], backgroundVariant: "gradient" } },
  ];
}

describe("addSection", () => {
  it("appends at the end when afterId is null", () => {
    const next = addSection(fixture(), blankSection("about"), null);
    expect(next.map((s) => s.id).slice(-1)[0]).toBe(next[next.length - 1].id);
    expect(next).toHaveLength(4);
  });

  it("inserts right after the given id", () => {
    const s = blankSection("about");
    const next = addSection(fixture(), s, "a");
    expect(next.map((x) => x.id)).toEqual(["a", s.id, "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = fixture();
    addSection(input, blankSection("about"));
    expect(input).toHaveLength(3);
  });
});

describe("removeSection", () => {
  it("removes the matching section only", () => {
    expect(removeSection(fixture(), "b").map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("is a no-op for an unknown id", () => {
    expect(removeSection(fixture(), "zzz")).toHaveLength(3);
  });
});

describe("moveSection", () => {
  it("swaps with the next section when dir is 1", () => {
    expect(moveSection(fixture(), "a", 1).map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("swaps with the previous section when dir is -1", () => {
    expect(moveSection(fixture(), "c", -1).map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("is a no-op past the array bounds", () => {
    expect(moveSection(fixture(), "a", -1).map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(moveSection(fixture(), "c", 1).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});

describe("reorderSections", () => {
  it("moves an item from one index to another", () => {
    expect(reorderSections(fixture(), 0, 2).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("is a no-op for out-of-range indexes", () => {
    expect(reorderSections(fixture(), 0, 5)).toHaveLength(3);
  });
});

describe("toggleSection", () => {
  it("flips enabled on the matching section only", () => {
    const next = toggleSection(fixture(), "c");
    expect(next.find((s) => s.id === "c")?.enabled).toBe(true);
    expect(next.find((s) => s.id === "a")?.enabled).toBe(true);
  });
});

describe("updateSection", () => {
  it("merges a content patch without touching other fields", () => {
    const next = updateSection(fixture(), "a", { content: { heading: "New heading" } });
    const a = next.find((s) => s.id === "a");
    expect(a?.type === "hero" && a.content.heading).toBe("New heading");
    expect(a?.type === "hero" && a.content.backgroundVariant).toBe("rings");
  });

  it("replaces top-level fields like headingOverride directly", () => {
    const next = updateSection(fixture(), "b", { headingOverride: "Our numbers" });
    expect(next.find((s) => s.id === "b")?.headingOverride).toBe("Our numbers");
  });

  it("leaves other sections untouched", () => {
    const next = updateSection(fixture(), "a", { content: { heading: "X" } });
    expect(next.find((s) => s.id === "b")).toEqual(fixture()[1]);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npx vitest run src/lib/homepage/sections/ops.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/homepage/sections/ops.ts src/lib/homepage/sections/ops.test.ts
git commit -m "feat(homepage): add pure section reorder/toggle/update ops"
```

---

### Task 4: Homepage data loaders

**Files:**
- Create: `src/lib/data/homepage.ts`

**Interfaces:**
- Consumes: `homepageSectionsSchema`, `HomepageSections` from `@/lib/homepage/sections/schema` (Task 1); `db` from `@/lib/db`; `TAGS` from `@/lib/cache-tags`.
- Produces: `loadDraftHomepage(): Promise<{ id: string; sections: HomepageSections }>` (get-or-create, uncached, admin-only); `getPublishedHomepage(): Promise<HomepageSections>` (cached under `TAGS.homepage`, used by the public site and the standalone preview's "what's live" comparison if needed); `loadHomepageHistory(): Promise<HomepageHistoryEntry[]>`.

- [ ] **Step 1: Write the module**

```ts
// src/lib/data/homepage.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { homepageSectionsSchema, type HomepageSections } from "@/lib/homepage/sections/schema";

function parseSections(raw: unknown): HomepageSections {
  const parsed = homepageSectionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** The single editable draft row. Created on first use — there is no seed for it. */
export async function loadDraftHomepage(): Promise<{ id: string; sections: HomepageSections }> {
  const existing = await db.homepageRevision.findFirst({ where: { status: "DRAFT" } });
  if (existing) return { id: existing.id, sections: parseSections(existing.sections) };
  const created = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [] } });
  return { id: created.id, sections: [] };
}

async function loadPublishedHomepage(): Promise<HomepageSections> {
  const row = await db.homepageRevision.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } });
  return row ? parseSections(row.sections) : [];
}

/** Cached for the public homepage; invalidated by `publishHomepageAction`. */
export const getPublishedHomepage = unstable_cache(loadPublishedHomepage, ["published-homepage"], { tags: [TAGS.homepage] });

export type HomepageHistoryEntry = { id: string; status: "PUBLISHED" | "SUPERSEDED"; publishedAt: string | null; publishedByName: string | null };

export async function loadHomepageHistory(): Promise<HomepageHistoryEntry[]> {
  const rows = await db.homepageRevision.findMany({
    where: { status: { in: ["PUBLISHED", "SUPERSEDED"] } },
    include: { publishedBy: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status as "PUBLISHED" | "SUPERSEDED",
    publishedAt: r.publishedAt?.toISOString() ?? null,
    publishedByName: r.publishedBy?.name ?? null,
  }));
}
```

This file imports `@/lib/db`, so (matching the `clean-name.ts` lesson from Phase 3) it is **not** unit tested — its logic is exercised by the integration tests in Task 5.

- [ ] **Step 2: Manual smoke check (no test DB write yet — this just confirms it compiles and the query shape is right)**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "data/homepage.ts" || echo "no errors in this file"
```

Expected: `no errors in this file`. (Full `npm run typecheck` runs at the end of Task 6 once the actions that consume this file also exist.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/homepage.ts
git commit -m "feat(homepage): add draft/published/history data loaders"
```

---

### Task 5: Draft/publish/restore server actions

**Files:**
- Create: `src/server/actions/homepage.ts`
- Test (integration, against the dedicated test DB — follow the exact setup already used by `src/server/forms/submit.test.ts` or equivalent Phase 3 integration test for connecting to `g4g-test`): `src/server/actions/homepage.test.ts`

**Interfaces:**
- Consumes: `runAction`, `ActionResult` (`@/lib/actions`); `writeAuditLog` (`@/lib/audit`); `requirePermission` (`@/lib/auth/guard`); `TAGS`, `invalidate` (`@/lib/cache-tags`); `db` (`@/lib/db`); `UserError` (`@/lib/errors`); `homepageSectionsSchema` (`@/lib/homepage/sections/schema`); `getRequestMeta` (`@/lib/request-meta`).
- Produces: `saveHomepageDraftAction(revisionId: string, sections: unknown): Promise<ActionResult<{ savedAt: string }>>`; `publishHomepageAction(revisionId: string): Promise<ActionResult<{ publishedAt: string }>>`; `restoreHomepageRevisionAction(revisionId: string, historyId: string): Promise<ActionResult<{ sections: HomepageSections }>>`.

- [ ] **Step 1: Write the actions**

```ts
// src/server/actions/homepage.ts
"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import type { SessionUser } from "@/lib/auth/session";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { homepageSectionsSchema, type HomepageSections } from "@/lib/homepage/sections/schema";
import { getRequestMeta } from "@/lib/request-meta";

const actorOf = (u: SessionUser) => ({ id: u.id, name: u.name });

/** Builder autosave: stores the draft if its shape is valid. */
export async function saveHomepageDraftAction(revisionId: string, sections: unknown): Promise<ActionResult<{ savedAt: string }>> {
  return runAction(async () => {
    await requirePermission("homepage.edit");
    const parsed = homepageSectionsSchema.safeParse(sections);
    if (!parsed.success) throw new UserError("Not saved yet. Check the highlighted section.");
    const { count } = await db.homepageRevision.updateMany({
      where: { id: revisionId, status: "DRAFT" },
      data: { sections: parsed.data as Prisma.InputJsonValue },
    });
    if (!count) throw new UserError("That draft no longer exists. Reload the page.");
    return { savedAt: new Date().toISOString() };
  });
}

export async function publishHomepageAction(revisionId: string): Promise<ActionResult<{ publishedAt: string }>> {
  return runAction(async () => {
    const user = await requirePermission("homepage.publish");
    const draft = await db.homepageRevision.findUnique({ where: { id: revisionId } });
    if (!draft || draft.status !== "DRAFT") throw new UserError("That draft no longer exists. Reload the page.");
    const meta = await getRequestMeta();
    const publishedAt = await db.$transaction(async (tx) => {
      await tx.homepageRevision.updateMany({ where: { status: "PUBLISHED" }, data: { status: "SUPERSEDED" } });
      const now = new Date();
      await tx.homepageRevision.create({
        data: { status: "PUBLISHED", sections: draft.sections as Prisma.InputJsonValue, publishedAt: now, publishedById: user.id },
      });
      await writeAuditLog(tx, { actor: actorOf(user), action: "homepage.published", target: { type: "HomepageRevision", id: revisionId, label: "Homepage" }, meta });
      return now;
    });
    invalidate(TAGS.homepage);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    return { publishedAt: publishedAt.toISOString() };
  });
}

/** Copies an old PUBLISHED/SUPERSEDED revision's sections back into the current draft, for review before re-publishing. */
export async function restoreHomepageRevisionAction(revisionId: string, historyId: string): Promise<ActionResult<{ sections: HomepageSections }>> {
  return runAction(async () => {
    const user = await requirePermission("homepage.edit");
    const historic = await db.homepageRevision.findUnique({ where: { id: historyId } });
    if (!historic || historic.status === "DRAFT") throw new UserError("That revision no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      const { count } = await tx.homepageRevision.updateMany({
        where: { id: revisionId, status: "DRAFT" },
        data: { sections: historic.sections as Prisma.InputJsonValue },
      });
      if (!count) throw new UserError("That draft no longer exists. Reload the page.");
      await writeAuditLog(tx, { actor: actorOf(user), action: "homepage.restored", target: { type: "HomepageRevision", id: historyId, label: "Homepage" }, meta });
    });
    revalidatePath("/admin/homepage");
    return { sections: homepageSectionsSchema.parse(historic.sections) };
  });
}
```

Note on the race the advisor flagged in Phase 3: `publishHomepageAction` reads `draft.sections` fresh from the DB inside the action, exactly like `publishFormAction` reads `form.draftDefinition`. The client (Task 9) must call `flushSave()` and `await` it before calling this action — same as `handlePublish` in `form-builder.tsx` — so what gets published is guaranteed to be what's on screen.

- [ ] **Step 2: Write integration tests against the test DB**

Follow whatever connection setup an existing Phase 2/3 integration test file uses (check `src/server/actions/*.test.ts` or `src/server/forms/*.test.ts` for the exact `DATABASE_URL`/test-DB bootstrap pattern already in this repo — reuse it verbatim, do not invent a new one).

```ts
// src/server/actions/homepage.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { publishHomepageAction, restoreHomepageRevisionAction, saveHomepageDraftAction } from "./homepage";
// Import whatever test-session helper the existing Phase 2/3 action tests use to run as a permitted admin
// (e.g. a `withTestUser`/`asAdmin` helper — match the exact name already in use in this codebase).

describe("homepage actions", () => {
  beforeEach(async () => {
    await db.homepageRevision.deleteMany();
  });

  it("creates and saves a draft", async () => {
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [] } });
    const sections = [{ id: "sec_1", type: "cta", enabled: true, content: { heading: "Join", ctas: [{ label: "Go", href: "/x", style: "primary" }], backgroundVariant: "gradient" } }];
    const result = await saveHomepageDraftAction(draft.id, sections);
    expect(result.ok).toBe(true);
    const row = await db.homepageRevision.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.sections).toEqual(sections);
  });

  it("rejects an invalid draft shape without touching the row", async () => {
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [{ id: "sec_1", type: "cta", enabled: true, content: { heading: "Keep me" } }] } });
    const result = await saveHomepageDraftAction(draft.id, [{ id: "sec_1", type: "bogus" }]);
    expect(result.ok).toBe(false);
    const row = await db.homepageRevision.findUniqueOrThrow({ where: { id: draft.id } });
    expect((row.sections as unknown[])[0]).toMatchObject({ type: "cta" });
  });

  it("publishes the current draft, superseding the previous published revision", async () => {
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [{ id: "sec_1", type: "cta", enabled: true, content: { heading: "v1", ctas: [{ label: "Go", href: "/x", style: "primary" }], backgroundVariant: "gradient" } }] } });
    const first = await publishHomepageAction(draft.id);
    expect(first.ok).toBe(true);

    await saveHomepageDraftAction(draft.id, [{ id: "sec_1", type: "cta", enabled: true, content: { heading: "v2", ctas: [{ label: "Go", href: "/x", style: "primary" }], backgroundVariant: "gradient" } }]);
    const second = await publishHomepageAction(draft.id);
    expect(second.ok).toBe(true);

    const revisions = await db.homepageRevision.findMany({ orderBy: { createdAt: "asc" } });
    const statuses = revisions.map((r) => r.status);
    expect(statuses).toContain("SUPERSEDED");
    expect(statuses.filter((s) => s === "PUBLISHED")).toHaveLength(1);
  });

  it("restores an old revision's sections into the draft", async () => {
    const draft = await db.homepageRevision.create({ data: { status: "DRAFT", sections: [] } });
    await saveHomepageDraftAction(draft.id, [{ id: "sec_1", type: "cta", enabled: true, content: { heading: "old", ctas: [{ label: "Go", href: "/x", style: "primary" }], backgroundVariant: "gradient" } }]);
    await publishHomepageAction(draft.id);
    await saveHomepageDraftAction(draft.id, [{ id: "sec_1", type: "cta", enabled: true, content: { heading: "new", ctas: [{ label: "Go", href: "/x", style: "primary" }], backgroundVariant: "gradient" } }]);

    const published = await db.homepageRevision.findFirstOrThrow({ where: { status: "PUBLISHED" } });
    const result = await restoreHomepageRevisionAction(draft.id, published.id);
    expect(result.ok).toBe(true);
    const row = await db.homepageRevision.findUniqueOrThrow({ where: { id: draft.id } });
    expect((row.sections as { content: { heading: string } }[])[0].content.heading).toBe("old");
  });
});
```

- [ ] **Step 3: Run against the test DB**

```bash
DATABASE_URL=<g4g-test connection string, same one used by every other Phase 2/3 integration test> npx vitest run src/server/actions/homepage.test.ts
```

Expected: all 4 pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/homepage.ts src/server/actions/homepage.test.ts
git commit -m "feat(homepage): add draft save, publish and restore actions"
```

---

## Task Group C — Vertical slice: hero, stats, event_spotlight, cta

The next four tasks build one working end-to-end path (admin editor → save → publish → public homepage) through exactly four section types, proving the whole architecture before Task Group D multiplies it by seven. Task 9 (the admin editor) is the biggest task in this plan — it is kept as one task because the section list, inspector, and autosave machinery are too entangled to review independently (same reasoning `form-builder.tsx` was one file in Phase 3).

### Task 6: Renderer components for hero, stats, event_spotlight, cta

**Files:**
- Create: `src/components/homepage/sections/hero.tsx`
- Create: `src/components/homepage/sections/stats.tsx`
- Create: `src/components/homepage/sections/event-spotlight.tsx`
- Create: `src/components/homepage/sections/cta.tsx`
- Create: `src/components/homepage/section-renderer.tsx`

**Interfaces:**
- Consumes: `Section`, `SectionOfType` (`@/lib/homepage/sections/schema`); `HeroContent`/`StatsContent`/`EventSpotlightContent`/`CtaContent`; `EventCard`, `EventCardDTO`, `getPublicEvents` (`@/lib/data/events`); `Countdown` (`@/components/events/countdown`); `Rings` (`@/components/site/rings`); `LogoTile` (`@/components/brand/logo-tile`); `socialLinks`, `SocialIcon` (`@/components/site/social-icons`); `getSiteSettings` (`@/lib/data/site`); `db` (`@/lib/db`, for `stats`' computed sources only).
- Produces: `HeroSection({ section, images }: { section: SectionOfType<"hero">; images: Record<string, PublicImage> })`; `StatsSection({ section }: { section: SectionOfType<"stats"> })` (async server component — computes auto sources itself); `EventSpotlightSection({ section, now, timezone }: { section: SectionOfType<"event_spotlight">; now: Date; timezone: string })` (async); `CtaSection({ section })`; `SectionRenderer({ sections, images, now, timezone }: { sections: HomepageSections; images: Record<string, PublicImage>; now: Date; timezone: string })` — the dispatcher, one `<section>` per enabled entry, `default: return null` for the 7 types Task Group D hasn't wired in yet.

- [ ] **Step 1: `hero.tsx`**

```tsx
// src/components/homepage/sections/hero.tsx
import Link from "next/link";
import { LogoTile } from "@/components/brand/logo-tile";
import { Rings } from "@/components/site/rings";
import { SocialIcon, socialLinks } from "@/components/site/social-icons";
import type { PublicImage } from "@/lib/media/public-image";
import type { Socials } from "@/lib/settings/schema";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { cn } from "@/lib/utils/cn";

export function HeroSection({ section, socials }: { section: SectionOfType<"hero">; socials: Socials }) {
  const c = section.content;
  return (
    <section id={section.anchorId} className="relative isolate overflow-hidden">
      {c.backgroundVariant === "rings" && <Rings className="pointer-events-none absolute -right-48 top-1/2 -z-10 size-[760px] -translate-y-1/2 opacity-50" />}
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-16 sm:px-6 md:grid-cols-[1.3fr_1fr] md:items-center md:pt-24 lg:px-8">
        <div className="grid gap-6">
          {c.eyebrow && <p className="font-mono text-xs uppercase tracking-[0.1em] text-leaf">{c.eyebrow}</p>}
          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            {section.headingOverride || c.heading}
            {c.highlightedWord && <span className="text-leaf"> {c.highlightedWord}</span>}
          </h1>
          {(section.subheadingOverride || c.subheading) && <p className="max-w-xl text-lg text-muted">{section.subheadingOverride || c.subheading}</p>}
          {c.ctas.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {c.ctas.map((cta, i) => (
                <Link
                  key={i}
                  href={cta.href}
                  className={cn(
                    "rounded-full px-5 py-3 font-semibold",
                    cta.style === "primary" ? "bg-leaf text-night" : "border border-line text-frost hover:bg-raised",
                  )}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          )}
          {c.showSocials && (
            <div className="flex gap-3 pt-2">
              {socialLinks(socials).map((link) => (
                <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-full border border-line text-muted hover:text-leaf">
                  <SocialIcon network={link.network} />
                </a>
              ))}
            </div>
          )}
        </div>
        {c.showLogoTile && (
          <div className="justify-self-center">
            <LogoTile size="lg" priority />
          </div>
        )}
      </div>
    </section>
  );
}
```

(`terminalLines` from the content schema is intentionally left unused here for now — the original interim homepage never rendered a terminal block, and no existing component renders one. Note it in the completion report as a gap against spec §8's field list rather than inventing a new visual component; either a follow-up task adds a small `<pre>`-based terminal block or the field stays inert.)

- [ ] **Step 2: `stats.tsx`**

```tsx
// src/components/homepage/sections/stats.tsx
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

async function computeAuto(source: "events_completed" | "team_members" | "gallery_photos"): Promise<number> {
  switch (source) {
    case "events_completed":
      return db.event.count({ where: { lifecycle: "ARCHIVED" } });
    case "team_members":
      return db.teamMember.count({ where: { term: { isCurrent: true } } });
    case "gallery_photos":
      return db.galleryImage.count({ where: { album: { isPublished: true } } });
  }
}

export async function StatsSection({ section }: { section: SectionOfType<"stats"> }) {
  const c = section.content;
  if (c.items.length === 0) return null;
  const values = await Promise.all(c.items.map((item) => (item.source === "manual" ? Promise.resolve(item.value ?? 0) : computeAuto(item.source))));
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {c.items.map((item, i) => (
          <div key={item.id} className="grid gap-1 rounded-2xl border border-line bg-surface p-6 text-center">
            <dt className="text-sm text-muted">{item.label}</dt>
            <dd className="font-display text-4xl font-extrabold text-leaf">
              {values[i]}
              {item.suffix}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
```

Confirmed against `prisma/schema.prisma`: `GalleryImage.album` and `TeamMember.term` are the exact relation names, and `TeamMember.photo` is the exact relation to `Upload` — no adjustment needed.

- [ ] **Step 3: `event-spotlight.tsx`**

```tsx
// src/components/homepage/sections/event-spotlight.tsx
import { EventCard } from "@/components/events/event-card";
import { Countdown } from "@/components/events/countdown";
import { getPublicEvents } from "@/lib/data/events";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function EventSpotlightSection({ section, now, timezone }: { section: SectionOfType<"event_spotlight">; now: Date; timezone: string }) {
  const c = section.content;
  const events = await getPublicEvents();
  const event =
    c.mode === "pinned"
      ? (events.find((e) => e.id === c.eventId && e.lifecycle === "PUBLISHED") ?? null)
      : events
          .filter((e) => e.lifecycle === "PUBLISHED" && new Date(e.startAt) > now)
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] ?? null;
  if (!event) return null;

  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {(section.headingOverride || section.subheadingOverride) && (
        <div className="mb-8 grid gap-2 text-center">
          {section.headingOverride && <h2 className="font-display text-3xl font-bold">{section.headingOverride}</h2>}
          {section.subheadingOverride && <p className="text-muted">{section.subheadingOverride}</p>}
        </div>
      )}
      <div className="mx-auto grid max-w-md gap-4">
        <EventCard event={event} timezone={timezone} now={now} />
        {c.showCountdown && <Countdown target={event.startAt} label="Starts in" />}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `cta.tsx`**

```tsx
// src/components/homepage/sections/cta.tsx
import Link from "next/link";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { cn } from "@/lib/utils/cn";

const BG: Record<SectionOfType<"cta">["content"]["backgroundVariant"], string> = {
  solid: "bg-surface border border-line",
  gradient: "border border-leaf/25 bg-[radial-gradient(circle_at_85%_15%,rgb(92_201_123/0.18),transparent_50%)]",
  outline: "border border-line",
};

export function CtaSection({ section }: { section: SectionOfType<"cta"> }) {
  const c = section.content;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className={cn("grid gap-4 rounded-3xl p-8 text-center sm:p-10", BG[c.backgroundVariant])}>
        {c.eyebrow && <p className="font-mono text-xs uppercase tracking-[0.1em] text-leaf">{c.eyebrow}</p>}
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{section.headingOverride || c.heading}</h2>
        {(section.subheadingOverride || c.subheading) && <p className="mx-auto max-w-xl text-muted">{section.subheadingOverride || c.subheading}</p>}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {c.ctas.map((cta, i) => (
            <Link
              key={i}
              href={cta.href}
              className={cn("rounded-full px-5 py-3 font-semibold", cta.style === "primary" ? "bg-leaf text-night" : "border border-line text-frost hover:bg-raised")}
            >
              {cta.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: `section-renderer.tsx`**

```tsx
// src/components/homepage/section-renderer.tsx
import type { HomepageSections } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";
import type { Socials } from "@/lib/settings/schema";
import { CtaSection } from "./sections/cta";
import { EventSpotlightSection } from "./sections/event-spotlight";
import { HeroSection } from "./sections/hero";
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
            case "stats":
              return <StatsSection key={section.id} section={section} />;
            case "event_spotlight":
              return <EventSpotlightSection key={section.id} section={section} now={now} timezone={timezone} />;
            case "cta":
              return <CtaSection key={section.id} section={section} />;
            default:
              return null; // about, announcements, achievements, featured_team, gallery_highlights, sponsors, social — wired in Task Group D
          }
        })}
    </>
  );
}
```

`images` is accepted now (for the `about` section's `imageId` in Task Group D) even though `hero`/`stats`/`event_spotlight`/`cta` don't use it yet — avoids reshaping this component's props again in Task Group D.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "components/homepage" || echo "no errors"
```

- [ ] **Step 7: Commit**

```bash
git add src/components/homepage
git commit -m "feat(homepage): add renderers for hero, stats, event spotlight and cta sections"
```

---

### Task 7: Public homepage wiring

**Files:**
- Modify: `src/app/(site)/page.tsx`

**Interfaces:**
- Consumes: `getPublishedHomepage` (`@/lib/data/homepage`); `SectionRenderer` (`@/components/homepage/section-renderer`); `getSiteSettings` (`@/lib/data/site`); `resolveContentImages`-equivalent for homepage `about.imageId` (deferred to Task 12 — pass `{}` for now).

- [ ] **Step 1: Replace the interim homepage**

```tsx
// src/app/(site)/page.tsx
import { SectionRenderer } from "@/components/homepage/section-renderer";
import { getPublishedHomepage } from "@/lib/data/homepage";
import { getSiteSettings } from "@/lib/data/site";

export default async function HomePage() {
  const [sections, site] = await Promise.all([getPublishedHomepage(), getSiteSettings()]);
  if (sections.length === 0) {
    return (
      <section className="mx-auto grid max-w-3xl gap-3 px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">{site.clubName}</h1>
        <p className="text-muted">The homepage hasn&apos;t been published yet.</p>
      </section>
    );
  }
  return <SectionRenderer sections={sections} images={{}} socials={site.socials} now={new Date()} timezone={site.timezone} />;
}
```

The empty-state fallback matters: right after this ships, the DRAFT row exists but nothing has been published yet, so the live site must not crash or show a blank `<body>`.

- [ ] **Step 2: Manual check**

```bash
npm run dev
```

Visit `/` — expect the empty-state message (nothing published yet). This is expected until Task 9's editor + a manual publish exist.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(site\)/page.tsx
git commit -m "feat(homepage): render published sections on the public homepage"
```

---

### Task 8: Homepage admin page + dashboard shortcut

**Files:**
- Create: `src/app/admin/(panel)/homepage/page.tsx`
- Modify: `src/components/admin/quick-actions.ts`

**Interfaces:**
- Consumes: `requirePagePermission` (`@/lib/auth/guard`); `loadDraftHomepage` (`@/lib/data/homepage`); the `HomepageBuilder` client component (Task 9, written next — this task's `page.tsx` references it, so do Task 8 and Task 9 in the same work session before running typecheck).
- Produces: the `/admin/homepage` route.

- [ ] **Step 1: Write the page**

```tsx
// src/app/admin/(panel)/homepage/page.tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadDraftHomepage } from "@/lib/data/homepage";
import { HomepageBuilder } from "./homepage-builder";

export const metadata: Metadata = { title: "Homepage" };

export default async function HomepageAdminPage() {
  await requirePagePermission("homepage.edit");
  const draft = await loadDraftHomepage();
  return (
    <div className="grid gap-6">
      <PageHeader title="Homepage" description="Compose the sections that appear on the public homepage." />
      <HomepageBuilder revisionId={draft.id} initialSections={draft.sections} />
    </div>
  );
}
```

(Check `src/components/admin/page-header.tsx` for the exact `PageHeader` prop names before writing this — it's used by every other admin list page such as `src/app/admin/(panel)/pages/page.tsx`; match its signature exactly rather than guessing.)

- [ ] **Step 2: Add the dashboard shortcut**

In `src/components/admin/quick-actions.ts`, add one entry (pick an unused `lucide-react` icon, e.g. `LayoutTemplate`):

```ts
{ href: "/admin/homepage", label: "Edit homepage", description: "Sections, layout and what's live", icon: LayoutTemplate, permission: "homepage.edit" },
```

Insert it near the top of the `QUICK_ACTIONS` array (homepage edits are high-frequency) and add `LayoutTemplate` to the existing `lucide-react` import list at the top of the file.

- [ ] **Step 3: Commit** (after Task 9 exists and this compiles — see Task 9's own commit step; this task's changes are committed together with Task 9's, since `page.tsx` doesn't compile without `homepage-builder.tsx`)

---

### Task 9: Homepage builder (autosave, section list, inspector, preview trigger)

**Files:**
- Create: `src/app/admin/(panel)/homepage/homepage-builder.tsx`
- Create: `src/app/admin/(panel)/homepage/section-list.tsx`
- Create: `src/app/admin/(panel)/homepage/inspector.tsx`
- Create: `src/app/admin/(panel)/homepage/section-forms/hero.tsx`
- Create: `src/app/admin/(panel)/homepage/section-forms/stats.tsx`
- Create: `src/app/admin/(panel)/homepage/section-forms/event-spotlight.tsx`
- Create: `src/app/admin/(panel)/homepage/section-forms/cta.tsx`

**Interfaces:**
- Consumes: `addSection`, `removeSection`, `reorderSections`, `toggleSection`, `updateSection` (`@/lib/homepage/sections/ops`); `blankSection` (`@/lib/homepage/sections/factories`); `SECTION_META`, `SECTION_TYPES` (`@/lib/homepage/sections/meta`, `.../schema`); `saveHomepageDraftAction`, `publishHomepageAction` (`@/server/actions/homepage`); `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (Task 0 must be done first).
- Produces: `HomepageBuilder({ revisionId, initialSections }: { revisionId: string; initialSections: HomepageSections })` — the exported client component `page.tsx` (Task 8) renders.

- [ ] **Step 1: `homepage-builder.tsx` — orchestrator, copying the exact autosave machine from `form-builder.tsx`**

```tsx
// src/app/admin/(panel)/homepage/homepage-builder.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blankSection } from "@/lib/homepage/sections/factories";
import { addSection, removeSection, reorderSections, toggleSection, updateSection } from "@/lib/homepage/sections/ops";
import type { HomepageSections, Section, SectionType } from "@/lib/homepage/sections/schema";
import { publishHomepageAction, saveHomepageDraftAction } from "@/server/actions/homepage";
import { cn } from "@/lib/utils/cn";
import { Inspector } from "./inspector";
import { SectionList } from "./section-list";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function HomepageBuilder({ revisionId, initialSections }: { revisionId: string; initialSections: HomepageSections }) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);

  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  // Same serialized-save pattern as the form builder: at most one save in flight, Publish awaits it
  // so it always publishes what's on screen, not a stale row.
  const flushSave = useCallback((): Promise<boolean> => {
    if (savePromiseRef.current) return savePromiseRef.current;
    const run = async (): Promise<boolean> => {
      let toSave = sectionsRef.current;
      for (;;) {
        setSaveState("saving");
        const result = await saveHomepageDraftAction(revisionId, toSave);
        if (!result.ok) {
          savePromiseRef.current = null;
          setSaveState("error");
          setSaveError(result.error);
          return false;
        }
        setSaveError(null);
        if (sectionsRef.current === toSave) {
          savePromiseRef.current = null;
          setSaveState("saved");
          return true;
        }
        toSave = sectionsRef.current;
      }
    };
    const p = run();
    savePromiseRef.current = p;
    return p;
  }, [revisionId]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushSave(), 800);
  }, [flushSave]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (saveState === "dirty" || saveState === "saving" || saveState === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  function apply(fn: (s: HomepageSections) => HomepageSections) {
    setSections((s) => {
      const next = fn(s);
      if (next !== s) {
        setSaveState("dirty");
        scheduleSave();
      }
      return next;
    });
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    const saved = await flushSave();
    if (!saved) {
      setPublishing(false);
      return;
    }
    const result = await publishHomepageAction(revisionId);
    setPublishing(false);
    if (!result.ok) {
      setPublishError(result.error);
      return;
    }
    setJustPublished(true);
    router.refresh();
  }

  const selected = sections.find((s) => s.id === selectedId) ?? null;
  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : saveState === "dirty" ? "Unsaved changes…" : saveState === "saved" ? "Draft saved" : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {saveState === "saving" && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted" aria-hidden="true" />}
          {saveState === "saved" && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-leaf" />}
          {saveState === "error" && <AlertTriangle className="size-3.5 shrink-0 text-danger" aria-hidden="true" />}
          <span className={cn(saveState === "error" ? "text-danger" : "text-muted")} role="status" aria-live="polite">
            {saveLabel}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/admin/homepage/preview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-full border border-line bg-raised px-3 text-[13px] font-semibold text-frost transition-colors duration-200 hover:bg-[#1d3527]"
          >
            <Eye className="size-4" aria-hidden="true" /> Preview
          </a>
          <Button type="button" size="sm" disabled={publishing} onClick={() => void handlePublish()}>
            {publishing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      {saveState === "error" && saveError && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Not saved: {saveError} Your edits are still here — fix the problem above and they&apos;ll save automatically.
        </p>
      )}
      {publishError && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {publishError}
        </p>
      )}
      {justPublished && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          <Check className="size-4 shrink-0" aria-hidden="true" /> Published. The live homepage now shows this.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <SectionList
          sections={sections}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={(from, to) => apply((s) => reorderSections(s, from, to))}
          onToggle={(id) => apply((s) => toggleSection(s, id))}
          onRemove={(id) => {
            if (id === selectedId) setSelectedId(null);
            apply((s) => removeSection(s, id));
          }}
          onAdd={(type: SectionType) => {
            const section = blankSection(type);
            apply((s) => addSection(s, section));
            setSelectedId(section.id);
          }}
        />
        <Inspector
          section={selected}
          onUpdate={(patch: Partial<Section>) => selected && apply((s) => updateSection(s, selected.id, patch))}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `section-list.tsx` — dnd-kit sortable list with keyboard support**

```tsx
// src/app/admin/(panel)/homepage/section-list.tsx
"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SECTION_META } from "@/lib/homepage/sections/meta";
import { SECTION_TYPES, type HomepageSections, type SectionType } from "@/lib/homepage/sections/schema";
import { cn } from "@/lib/utils/cn";

function Row({ id, label, enabled, selected, onSelect, onToggle, onRemove }: { id: string; label: string; enabled: boolean; selected: boolean; onSelect: () => void; onToggle: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5",
        selected ? "border-leaf/40 bg-leaf/5" : "border-line bg-surface",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <button type="button" {...attributes} {...listeners} aria-label={`Reorder ${label}`} className="cursor-grab touch-none rounded p-1 text-muted hover:text-frost active:cursor-grabbing">
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onSelect} className={cn("min-w-0 flex-1 truncate text-left text-sm", !enabled && "text-muted line-through")}>
        {label}
      </button>
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
        <input type="checkbox" checked={enabled} onChange={onToggle} className="size-3.5 accent-leaf" />
        Show
      </label>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="shrink-0 rounded p-1 text-muted hover:text-danger">
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export function SectionList({
  sections,
  selectedId,
  onSelect,
  onReorder,
  onToggle,
  onRemove,
  onAdd,
}: {
  sections: HomepageSections;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (type: SectionType) => void;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from !== -1 && to !== -1) onReorder(from, to);
  }

  return (
    <div className="grid gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-2">
            {sections.map((s) => (
              <Row
                key={s.id}
                id={s.id}
                label={s.headingOverride || SECTION_META[s.type].label}
                enabled={s.enabled}
                selected={s.id === selectedId}
                onSelect={() => onSelect(s.id)}
                onToggle={() => onToggle(s.id)}
                onRemove={() => onRemove(s.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="relative">
        <Button type="button" variant="secondary" size="sm" onClick={() => setPaletteOpen((v) => !v)} className="w-full justify-center">
          <Plus className="size-4" aria-hidden="true" /> Add section
        </Button>
        {paletteOpen && (
          <ul className="absolute z-10 mt-1 grid w-full gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
            {SECTION_TYPES.map((type) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(type);
                    setPaletteOpen(false);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-raised"
                >
                  <span className="font-medium">{SECTION_META[type].label}</span>
                  <span className="block text-xs text-muted">{SECTION_META[type].description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

(Confirmed: `Button` (`src/components/ui/button.tsx`) has no `asChild` prop — it's a plain `React.ComponentProps<"button">` wrapper with no Slot/polymorphism support. The Preview link above is a plain `<a>` styled with the same class list `Button` builds internally for `variant="secondary" size="sm"`, so it matches visually without an unsupported prop.)

- [ ] **Step 3: `inspector.tsx` — dispatcher**

```tsx
// src/app/admin/(panel)/homepage/inspector.tsx
"use client";

import type { Section } from "@/lib/homepage/sections/schema";
import { CtaForm } from "./section-forms/cta";
import { EventSpotlightForm } from "./section-forms/event-spotlight";
import { HeroForm } from "./section-forms/hero";
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
```

- [ ] **Step 4: `section-forms/hero.tsx`**

```tsx
// src/app/admin/(panel)/homepage/section-forms/hero.tsx
"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function HeroForm({ section, onUpdate }: { section: SectionOfType<"hero">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Heading</span>
        <input value={c.heading} onChange={(e) => patchContent({ heading: e.target.value })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Highlighted word</span>
        <input value={c.highlightedWord ?? ""} onChange={(e) => patchContent({ highlightedWord: e.target.value || undefined })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Subheading</span>
        <textarea value={c.subheading ?? ""} onChange={(e) => patchContent({ subheading: e.target.value || undefined })} rows={2} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Background</span>
        <select value={c.backgroundVariant} onChange={(e) => patchContent({ backgroundVariant: e.target.value as typeof c.backgroundVariant })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
          <option value="rings">Rings</option>
          <option value="grid">Grid</option>
          <option value="glow">Glow</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={c.showLogoTile} onChange={(e) => patchContent({ showLogoTile: e.target.checked })} className="accent-leaf" />
        Show logo tile
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={c.showSocials} onChange={(e) => patchContent({ showSocials: e.target.checked })} className="accent-leaf" />
        Show social icons
      </label>
      <div className="grid gap-2">
        <p className="text-sm text-muted">Buttons (up to 2)</p>
        {c.ctas.map((cta, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5">
            <input value={cta.label} onChange={(e) => patchContent({ ctas: c.ctas.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
            <input value={cta.href} onChange={(e) => patchContent({ ctas: c.ctas.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} placeholder="/link" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
            <select value={cta.style} onChange={(e) => patchContent({ ctas: c.ctas.map((x, j) => (j === i ? { ...x, style: e.target.value as typeof x.style } : x)) })} className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm">
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
            </select>
            <button type="button" onClick={() => patchContent({ ctas: c.ctas.filter((_, j) => j !== i) })} className="rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
              ×
            </button>
          </div>
        ))}
        {c.ctas.length < 2 && (
          <button
            type="button"
            onClick={() => patchContent({ ctas: [...c.ctas, { label: "Learn more", href: "/", style: "primary" }] })}
            className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost"
          >
            + Add button
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `section-forms/stats.tsx`**

```tsx
// src/app/admin/(panel)/homepage/section-forms/stats.tsx
"use client";

import { newSectionId } from "@/lib/homepage/sections/factories";
import { STAT_SOURCES, type Section, type SectionOfType } from "@/lib/homepage/sections/schema";

const SOURCE_LABELS: Record<(typeof STAT_SOURCES)[number], string> = {
  manual: "Manual number",
  events_completed: "Events completed (auto)",
  team_members: "Current team size (auto)",
  gallery_photos: "Gallery photos (auto)",
};

export function StatsForm({ section, onUpdate }: { section: SectionOfType<"stats">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      {c.items.map((item, i) => (
        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-1.5 rounded-lg border border-line p-2">
          <div className="grid gap-1.5">
            <input
              value={item.label}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
              placeholder="Label"
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
            <select
              value={item.source}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, source: e.target.value as (typeof STAT_SOURCES)[number] } : x)) })}
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            >
              {STAT_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
            {item.source === "manual" && (
              <input
                type="number"
                value={item.value ?? ""}
                onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, value: e.target.value ? Number(e.target.value) : null } : x)) })}
                placeholder="Value"
                className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
              />
            )}
            <input
              value={item.suffix ?? ""}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, suffix: e.target.value || undefined } : x)) })}
              placeholder="Suffix (e.g. +)"
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
          </div>
          <button type="button" onClick={() => patchContent({ items: c.items.filter((_, j) => j !== i) })} className="self-start rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
            ×
          </button>
        </div>
      ))}
      {c.items.length < 6 && (
        <button
          type="button"
          onClick={() => patchContent({ items: [...c.items, { id: newSectionId(), label: "New stat", value: 0, source: "manual" }] })}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost"
        >
          + Add stat
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: `section-forms/event-spotlight.tsx`**

```tsx
// src/app/admin/(panel)/homepage/section-forms/event-spotlight.tsx
"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function EventSpotlightForm({ section, onUpdate }: { section: SectionOfType<"event_spotlight">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Which event</span>
        <select value={c.mode} onChange={(e) => patchContent({ mode: e.target.value as typeof c.mode })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
          <option value="next_upcoming">Next upcoming event (auto)</option>
          <option value="pinned">A specific event</option>
        </select>
      </label>
      {c.mode === "pinned" && (
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Event ID</span>
          <input value={c.eventId ?? ""} onChange={(e) => patchContent({ eventId: e.target.value || null })} placeholder="Paste the event's id" className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
          <span className="text-xs text-muted">Find the id in the event&apos;s admin URL, e.g. /admin/events/&lt;id&gt;/edit. A picker can replace this once the events list exposes one.</span>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={c.showCountdown} onChange={(e) => patchContent({ showCountdown: e.target.checked })} className="accent-leaf" />
        Show countdown
      </label>
    </div>
  );
}
```

(A raw event-id text field is a deliberate shortcut, not a placeholder — it's fully functional, just not as polished as a searchable picker. Note this as a judgment call when reporting: a follow-up could add an autocomplete picker backed by `getPublicEvents()`, but that's a UI-polish task, not a missing requirement.)

- [ ] **Step 7: `section-forms/cta.tsx`**

```tsx
// src/app/admin/(panel)/homepage/section-forms/cta.tsx
"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function CtaForm({ section, onUpdate }: { section: SectionOfType<"cta">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Heading</span>
        <input value={c.heading} onChange={(e) => patchContent({ heading: e.target.value })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Subheading</span>
        <textarea value={c.subheading ?? ""} onChange={(e) => patchContent({ subheading: e.target.value || undefined })} rows={2} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Background</span>
        <select value={c.backgroundVariant} onChange={(e) => patchContent({ backgroundVariant: e.target.value as typeof c.backgroundVariant })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
          <option value="outline">Outline</option>
        </select>
      </label>
      {c.ctas.map((cta, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <input value={cta.label} onChange={(e) => patchContent({ ctas: c.ctas.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="Label" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
          <input value={cta.href} onChange={(e) => patchContent({ ctas: c.ctas.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) })} placeholder="/link" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
          {c.ctas.length > 1 && (
            <button type="button" onClick={() => patchContent({ ctas: c.ctas.filter((_, j) => j !== i) })} className="rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
              ×
            </button>
          )}
        </div>
      ))}
      {c.ctas.length < 2 && (
        <button type="button" onClick={() => patchContent({ ctas: [...c.ctas, { label: "Get involved", href: "/events", style: "primary" }] })} className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost">
          + Add button
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Full quality gate**

```bash
npm run lint
npm run typecheck
npx vitest run src/lib/homepage
```

Fix anything that comes up (expect at least one round of prop-name corrections against whatever `PageHeader`/`Button` actually export — verify against their real source rather than assuming the signatures guessed above).

- [ ] **Step 9: Manual browser check**

Using `scripts/qa-session.mts` (never type a password) to get an admin session, visit `/admin/homepage`:
- Add one of each of the 4 wired section types, edit their fields, confirm "Draft saved" appears within ~1s of the last edit.
- Reorder sections by dragging, and again using keyboard (Tab to the grip handle, Space to pick up, arrow keys to move, Space to drop) — confirm both work.
- Toggle a section off, confirm it visually strikes through in the list.
- Click Publish, confirm the success banner, then open `/` in another tab and confirm the sections appear in the right order with disabled ones hidden.
- Resize to 400px width (`scripts/shoot.mts`, not the interactive tab — see the dev-environment memory note) and confirm the two-column layout collapses sanely.

- [ ] **Step 10: Commit (Task 8 + Task 9 together, since neither compiles alone)**

```bash
git add src/app/admin/\(panel\)/homepage src/components/admin/quick-actions.ts
git commit -m "feat(homepage): add admin editor with dnd-kit reordering and autosave"
```

---

## Task Group D — Remaining 7 section types

### Task 10: Renderers + inspector forms for about, achievements, social

These three don't depend on any Phase-5 admin screen existing — `about` and `cta`-adjacent content is fully admin-authored, `achievements` items are authored inline in the section (like `stats` items), and `social` reads `SiteSettings.socials` which Settings already manages.

**Files:**
- Create: `src/components/homepage/sections/about.tsx`, `achievements.tsx`, `social.tsx`
- Modify: `src/components/homepage/section-renderer.tsx` (add 3 cases)
- Create: `src/app/admin/(panel)/homepage/section-forms/about.tsx`, `achievements.tsx`, `social.tsx`
- Modify: `src/app/admin/(panel)/homepage/inspector.tsx` (add 3 cases)

**Interfaces:**
- Consumes: `AboutContent`, `AchievementsContent`, `SocialContent`, `SectionOfType` (`@/lib/homepage/sections/schema`); `PublicImage`, `Picture` for `about`'s optional image; `socialLinks`, `SocialIcon`, `Socials` for `social`.

- [ ] **Step 1: `about.tsx` renderer**

```tsx
// src/components/homepage/sections/about.tsx
import { Picture } from "@/components/media/picture";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";

export function AboutSection({ section, image }: { section: SectionOfType<"about">; image: PublicImage | null }) {
  const c = section.content;
  if (!c.body && !section.headingOverride) return null;
  return (
    <section id={section.anchorId} className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1fr] md:items-center lg:px-8">
      <div className="grid gap-3">
        {(section.headingOverride || c.heading) && <h2 className="font-display text-3xl font-bold">{section.headingOverride || c.heading}</h2>}
        {c.body.split("\n").filter(Boolean).map((para, i) => (
          <p key={i} className="text-muted">
            {para}
          </p>
        ))}
      </div>
      {image && <Picture image={image} sizes="(min-width: 768px) 480px, 100vw" alt="" className="overflow-hidden rounded-3xl" imgClassName="aspect-[4/3] w-full object-cover" />}
    </section>
  );
}
```

- [ ] **Step 2: `achievements.tsx` renderer**

```tsx
// src/components/homepage/sections/achievements.tsx
import { Picture } from "@/components/media/picture";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { PublicImage } from "@/lib/media/public-image";

export function AchievementsSection({ section, images }: { section: SectionOfType<"achievements">; images: Record<string, PublicImage> }) {
  const c = section.content;
  if (c.items.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {c.items
          .slice()
          .sort((a, b) => b.year - a.year)
          .map((item) => (
            <li key={item.id} className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
              {item.imageId && images[item.imageId] && (
                <Picture image={images[item.imageId]} sizes="360px" alt="" className="overflow-hidden rounded-xl" imgClassName="aspect-video w-full object-cover" />
              )}
              <p className="font-mono text-xs uppercase tracking-[0.1em] text-leaf">{item.year}</p>
              <h3 className="font-semibold">{item.title}</h3>
              {item.description && <p className="text-sm text-muted">{item.description}</p>}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-sm text-leaf hover:underline">
                  Learn more
                </a>
              )}
            </li>
          ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: `social.tsx` renderer**

```tsx
// src/components/homepage/sections/social.tsx
import { SocialIcon, socialLinks } from "@/components/site/social-icons";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import type { Socials } from "@/lib/settings/schema";

export function SocialSection({ section, socials }: { section: SectionOfType<"social">; socials: Socials }) {
  const links = socialLinks(socials);
  if (links.length === 0) return null;
  const c = section.content;
  return (
    <section id={section.anchorId} className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-6 font-display text-2xl font-bold">{section.headingOverride}</h2>}
      <div className="flex flex-wrap justify-center gap-3">
        {links.map((link) =>
          c.style === "buttons" ? (
            <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm hover:bg-raised">
              <SocialIcon network={link.network} className="size-4" /> {link.label}
            </a>
          ) : (
            <a key={link.key} href={link.url} target="_blank" rel="noopener noreferrer" aria-label={link.label} className="grid size-10 place-items-center rounded-full border border-line text-muted hover:text-leaf">
              <SocialIcon network={link.network} />
            </a>
          ),
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire the 3 cases into `section-renderer.tsx`**

Replace the `default: return null` block's preceding cases list by adding, and update the props signature to also accept `sponsors`/`site` where needed (only `socials` and `images` are needed here, both already threaded through since Task 6):

```tsx
// add these imports
import { AboutSection } from "./sections/about";
import { AchievementsSection } from "./sections/achievements";
import { SocialSection } from "./sections/social";

// inside the switch, before `default:`
case "about":
  return <AboutSection key={section.id} section={section} image={section.content.imageId ? (images[section.content.imageId] ?? null) : null} />;
case "achievements":
  return <AchievementsSection key={section.id} section={section} images={images} />;
case "social":
  return <SocialSection key={section.id} section={section} socials={socials} />;
```

- [ ] **Step 5: Inspector forms — `section-forms/about.tsx`, `achievements.tsx`, `social.tsx`**

```tsx
// src/app/admin/(panel)/homepage/section-forms/about.tsx
"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AboutForm({ section, onUpdate }: { section: SectionOfType<"about">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Heading</span>
        <input value={c.heading ?? ""} onChange={(e) => patchContent({ heading: e.target.value || undefined })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Body (one paragraph per line)</span>
        <textarea value={c.body} onChange={(e) => patchContent({ body: e.target.value })} rows={5} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
      <p className="text-xs text-muted">Image upload for this section reuses the same upload endpoint as other admin image fields — wire it up the same way `ImagePicker` does in `src/app/admin/(panel)/forms/[id]/build/inspector.tsx` if a photo is wanted here; `imageId` is already in the schema and ready to receive it.</p>
    </div>
  );
}
```

```tsx
// src/app/admin/(panel)/homepage/section-forms/achievements.tsx
"use client";

import { newSectionId } from "@/lib/homepage/sections/factories";
import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AchievementsForm({ section, onUpdate }: { section: SectionOfType<"achievements">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      {c.items.map((item, i) => (
        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-1.5 rounded-lg border border-line p-2">
          <div className="grid gap-1.5">
            <input value={item.title} onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Title" className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm" />
            <input
              type="number"
              value={item.year}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, year: Number(e.target.value) } : x)) })}
              placeholder="Year"
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
            <textarea
              value={item.description}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })}
              placeholder="Description"
              rows={2}
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
            <input
              value={item.link ?? ""}
              onChange={(e) => patchContent({ items: c.items.map((x, j) => (j === i ? { ...x, link: e.target.value || undefined } : x)) })}
              placeholder="Link (optional)"
              className="rounded-lg border border-line bg-transparent px-2 py-1 text-sm"
            />
          </div>
          <button type="button" onClick={() => patchContent({ items: c.items.filter((_, j) => j !== i) })} className="self-start rounded-lg border border-line px-2 text-sm text-muted hover:text-danger">
            ×
          </button>
        </div>
      ))}
      {c.items.length < 12 && (
        <button
          type="button"
          onClick={() => patchContent({ items: [...c.items, { id: newSectionId(), title: "New achievement", description: "", year: new Date().getFullYear() }] })}
          className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-frost"
        >
          + Add achievement
        </button>
      )}
    </div>
  );
}
```

```tsx
// src/app/admin/(panel)/homepage/section-forms/social.tsx
"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function SocialForm({ section, onUpdate }: { section: SectionOfType<"social">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">Style</span>
      <select value={c.style} onChange={(e) => onUpdate({ content: { style: e.target.value as typeof c.style } } as Partial<Section>)} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
        <option value="icons">Icons only</option>
        <option value="buttons">Labeled buttons</option>
      </select>
    </label>
  );
}
```

- [ ] **Step 6: Wire the 3 cases into `inspector.tsx`** (same pattern as Task 9 Step 3 — import each form, add a `case` before `default`)

- [ ] **Step 7: Typecheck, lint, unit tests**

```bash
npm run lint && npm run typecheck && npx vitest run src/lib/homepage
```

- [ ] **Step 8: Commit**

```bash
git add src/components/homepage src/app/admin/\(panel\)/homepage
git commit -m "feat(homepage): add about, achievements and social sections"
```

---

### Task 11: Renderers + inspector forms for announcements, featured_team, gallery_highlights, sponsors

These 4 query DB models whose admin CRUD screens ship in Phase 5 (`Announcement`, `TeamMember`/`TeamTerm`, `GalleryAlbum`/`GalleryImage` have no admin create/edit UI yet — only `Sponsor` already has one, from Phase 2). **This is expected, not a blocker**: the fields these queries filter on (`Announcement.showOnHomepage`, `TeamMember.featured` + `TeamTerm.isCurrent`, `GalleryAlbum.isPublished`) already exist on the Prisma models, so the query code is fully real and correct — it will simply return empty results until Phase 5 ships a way to set those flags through the UI (today, only direct DB/seed data can populate them). Each renderer below returns `null` on an empty result set, exactly like `StatsSection` and `AchievementsSection` already do, so an empty state never looks broken.

**Files:**
- Create: `src/components/homepage/sections/announcements.tsx`, `featured-team.tsx`, `gallery-highlights.tsx`, `sponsors.tsx`
- Modify: `src/components/homepage/section-renderer.tsx` (add 4 cases)
- Create: `src/app/admin/(panel)/homepage/section-forms/announcements.tsx`, `featured-team.tsx`, `gallery-highlights.tsx`, `sponsors.tsx`
- Modify: `src/app/admin/(panel)/homepage/inspector.tsx` (add 4 cases)

**Interfaces:**
- Consumes: `db` (`@/lib/db`) directly in the `announcements`/`featured_team`/`gallery_highlights` renderers (async server components, same style as `StatsSection`); `getPublicSponsors`, `SPONSOR_TIER_LABELS` (`@/lib/data/sponsors`, `@/lib/events/schema`) for `sponsors`; `Picture`, `PublicImage`.

- [ ] **Step 1: `announcements.tsx` renderer**

```tsx
// src/components/homepage/sections/announcements.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function AnnouncementsSection({ section }: { section: SectionOfType<"announcements"> }) {
  const rows = await db.announcement.findMany({
    where: { status: "PUBLISHED", showOnHomepage: true, publishAt: { lte: new Date() } },
    orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
    take: section.content.maxItems,
    select: { id: true, slug: true, title: true, summary: true, priority: true },
  });
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-6 font-display text-2xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid gap-3">
        {rows.map((a) => (
          <li key={a.id}>
            <Link href={`/announcements/${a.slug}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-leaf/30">
              <p className="font-medium">{a.title}</p>
              {a.summary && <p className="text-sm text-muted">{a.summary}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

(Links to `/announcements/[slug]`, which doesn't exist as a public route until Phase 5 — matches the same "the data model and query are real, the destination page ships later" situation as the DB queries themselves. Note this explicitly when reporting.)

- [ ] **Step 2: `featured-team.tsx` renderer**

```tsx
// src/components/homepage/sections/featured-team.tsx
import { Picture } from "@/components/media/picture";
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";

export async function FeaturedTeamSection({ section }: { section: SectionOfType<"featured_team"> }) {
  const rows = await db.teamMember.findMany({
    where: { featured: true, term: { isCurrent: true } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    take: section.content.maxItems,
    include: { photo: { select: publicImageSelect } },
  });
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((m) => {
          const photo = toPublicImage(m.photo);
          return (
            <li key={m.id} className="grid gap-2 text-center">
              <div className="mx-auto size-24 overflow-hidden rounded-full bg-tile">
                {photo && <Picture image={photo} sizes="96px" alt="" imgClassName="size-full object-cover" />}
              </div>
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-muted">{m.title}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: `gallery-highlights.tsx` renderer**

```tsx
// src/components/homepage/sections/gallery-highlights.tsx
import { Picture } from "@/components/media/picture";
import { db } from "@/lib/db";
import type { SectionOfType } from "@/lib/homepage/sections/schema";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";

export async function GalleryHighlightsSection({ section }: { section: SectionOfType<"gallery_highlights"> }) {
  const c = section.content;
  const rows = await db.galleryImage.findMany({
    where: c.mode === "album" && c.albumId ? { albumId: c.albumId, album: { isPublished: true } } : { album: { isPublished: true } },
    orderBy: { createdAt: "desc" },
    take: c.maxItems,
    include: { upload: { select: publicImageSelect } },
  });
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((g) => {
          const image = toPublicImage(g.upload);
          return (
            <li key={g.id} className="aspect-square overflow-hidden rounded-xl bg-tile">
              {image && <Picture image={image} sizes="240px" alt="" imgClassName="size-full object-cover" />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

Confirmed against `prisma/schema.prisma`: `GalleryImage` has `albumId`, `album` (relation to `GalleryAlbum`), `uploadId`, `upload` (relation to `Upload`), `caption`, `order`. The relation to `Upload` is named `upload`, not `image` — the code above uses the correct name.

- [ ] **Step 4: `sponsors.tsx` renderer**

```tsx
// src/components/homepage/sections/sponsors.tsx
import { Picture } from "@/components/media/picture";
import { getPublicSponsors } from "@/lib/data/sponsors";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function SponsorsSection({ section }: { section: SectionOfType<"sponsors"> }) {
  const all = await getPublicSponsors();
  const sponsors = section.content.tierFilter.length ? all.filter((s) => section.content.tierFilter.includes(s.tier)) : all;
  if (sponsors.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="flex flex-wrap items-center justify-center gap-8">
        {sponsors.map((s) => (
          <li key={s.id} className="grid h-16 place-items-center rounded-xl bg-tile px-6">
            {s.logo ? <Picture image={s.logo} sizes="160px" alt={s.name} imgClassName="max-h-10 w-auto object-contain" /> : <span className="font-semibold">{s.name}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Wire the 4 cases into `section-renderer.tsx`** (same pattern as Task 10 Step 4)

```tsx
case "announcements":
  return <AnnouncementsSection key={section.id} section={section} />;
case "featured_team":
  return <FeaturedTeamSection key={section.id} section={section} />;
case "gallery_highlights":
  return <GalleryHighlightsSection key={section.id} section={section} />;
case "sponsors":
  return <SponsorsSection key={section.id} section={section} />;
```

After this task, `section-renderer.tsx`'s `switch` should have no `default: return null` case left un-hit by a real type — leave the `default: return null` itself in place defensively (it's cheap insurance against a future 12th type being added to the schema without a renderer yet), but every one of the current 11 `SECTION_TYPES` now has a case above it.

- [ ] **Step 6: Inspector forms**

```tsx
// src/app/admin/(panel)/homepage/section-forms/announcements.tsx
"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function AnnouncementsForm({ section, onUpdate }: { section: SectionOfType<"announcements">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">Max announcements to show</span>
      <input
        type="number"
        min={1}
        max={10}
        value={c.maxItems}
        onChange={(e) => onUpdate({ content: { maxItems: Math.min(10, Math.max(1, Number(e.target.value) || 1)) } } as Partial<Section>)}
        className="w-24 rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm"
      />
      <span className="text-xs text-muted">Only announcements marked "Show on homepage" (set on the announcement itself, once Phase 5's announcements admin ships) are considered.</span>
    </label>
  );
}
```

```tsx
// src/app/admin/(panel)/homepage/section-forms/featured-team.tsx
"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function FeaturedTeamForm({ section, onUpdate }: { section: SectionOfType<"featured_team">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">Max members to show</span>
      <input
        type="number"
        min={1}
        max={12}
        value={c.maxItems}
        onChange={(e) => onUpdate({ content: { maxItems: Math.min(12, Math.max(1, Number(e.target.value) || 1)) } } as Partial<Section>)}
        className="w-24 rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm"
      />
      <span className="text-xs text-muted">Shows members marked "featured" on the current team (set per-member once Phase 5's team admin ships).</span>
    </label>
  );
}
```

```tsx
// src/app/admin/(panel)/homepage/section-forms/gallery-highlights.tsx
"use client";

import type { Section, SectionOfType } from "@/lib/homepage/sections/schema";

export function GalleryHighlightsForm({ section, onUpdate }: { section: SectionOfType<"gallery_highlights">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  const patchContent = (content: Partial<typeof c>) => onUpdate({ content } as Partial<Section>);
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Source</span>
        <select value={c.mode} onChange={(e) => patchContent({ mode: e.target.value as typeof c.mode })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm">
          <option value="latest">Latest photos across all albums</option>
          <option value="album">A specific album</option>
        </select>
      </label>
      {c.mode === "album" && (
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Album ID</span>
          <input value={c.albumId ?? ""} onChange={(e) => patchContent({ albumId: e.target.value || null })} className="rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
        </label>
      )}
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Max photos</span>
        <input type="number" min={1} max={24} value={c.maxItems} onChange={(e) => patchContent({ maxItems: Math.min(24, Math.max(1, Number(e.target.value) || 1)) })} className="w-24 rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm" />
      </label>
    </div>
  );
}
```

```tsx
// src/app/admin/(panel)/homepage/section-forms/sponsors.tsx
"use client";

import { SPONSOR_TIERS, type Section, type SectionOfType } from "@/lib/homepage/sections/schema";

const TIER_LABELS: Record<(typeof SPONSOR_TIERS)[number], string> = {
  TITLE: "Title",
  POWERED_BY: "Powered by",
  TECHNOLOGY_PARTNER: "Technology partner",
  COMMUNITY_PARTNER: "Community partner",
  PARTNER: "Partner",
};

export function SponsorsForm({ section, onUpdate }: { section: SectionOfType<"sponsors">; onUpdate: (patch: Partial<Section>) => void }) {
  const c = section.content;
  function toggle(tier: (typeof SPONSOR_TIERS)[number]) {
    const next = c.tierFilter.includes(tier) ? c.tierFilter.filter((t) => t !== tier) : [...c.tierFilter, tier];
    onUpdate({ content: { tierFilter: next } } as Partial<Section>);
  }
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-sm text-muted">Show tiers (none selected = show all)</legend>
      {SPONSOR_TIERS.map((tier) => (
        <label key={tier} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.tierFilter.includes(tier)} onChange={() => toggle(tier)} className="accent-leaf" />
          {TIER_LABELS[tier]}
        </label>
      ))}
    </fieldset>
  );
}
```

- [ ] **Step 7: Wire the 4 cases into `inspector.tsx`**

- [ ] **Step 8: Full quality gate**

```bash
npm run lint && npm run typecheck
npx vitest run src/lib/homepage
DATABASE_URL=<g4g-test> npx vitest run src/server/actions/homepage.test.ts
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/components/homepage src/app/admin/\(panel\)/homepage
git commit -m "feat(homepage): add announcements, featured team, gallery and sponsors sections"
```

---

### Task 12: Wire images and the remaining props into the public homepage

**Files:**
- Modify: `src/app/(site)/page.tsx`

Now that `about` and `achievements` sections can reference `imageId`s, the placeholder `images={{}}` from Task 7 needs real data — following the exact `resolveContentImages` pattern from `src/lib/forms/content-images.ts`.

**Interfaces:**
- Produces: `resolveHomepageImages(sections: HomepageSections): Promise<Record<string, PublicImage>>` in `src/lib/data/homepage.ts`.

- [ ] **Step 1: Add the resolver to `src/lib/data/homepage.ts`**

```ts
// add to src/lib/data/homepage.ts
import { publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";

export async function resolveHomepageImages(sections: HomepageSections): Promise<Record<string, PublicImage>> {
  const ids = new Set<string>();
  for (const s of sections) {
    if (s.type === "about" && s.content.imageId) ids.add(s.content.imageId);
    if (s.type === "achievements") for (const item of s.content.items) if (item.imageId) ids.add(item.imageId);
  }
  if (ids.size === 0) return {};
  const uploads = await db.upload.findMany({ where: { id: { in: [...ids] } }, select: publicImageSelect });
  const images: Record<string, PublicImage> = {};
  for (const u of uploads) {
    const img = toPublicImage(u);
    if (img) images[u.id] = img;
  }
  return images;
}
```

- [ ] **Step 2: Use it in the public homepage**

```tsx
// src/app/(site)/page.tsx
import { SectionRenderer } from "@/components/homepage/section-renderer";
import { getPublishedHomepage, resolveHomepageImages } from "@/lib/data/homepage";
import { getSiteSettings } from "@/lib/data/site";

export default async function HomePage() {
  const sections = await getPublishedHomepage();
  const [site, images] = await Promise.all([getSiteSettings(), resolveHomepageImages(sections)]);
  if (sections.length === 0) {
    return (
      <section className="mx-auto grid max-w-3xl gap-3 px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold">{site.clubName}</h1>
        <p className="text-muted">The homepage hasn&apos;t been published yet.</p>
      </section>
    );
  }
  return <SectionRenderer sections={sections} images={images} socials={site.socials} now={new Date()} timezone={site.timezone} />;
}
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run typecheck
git add src/lib/data/homepage.ts src/app/\(site\)/page.tsx
git commit -m "feat(homepage): resolve section image references on the public page"
```

---

### Task 13: Standalone preview route (outside the admin sidebar layout)

**Files:**
- Create: `src/app/admin/homepage/preview/page.tsx`
- Modify: `src/app/admin/(panel)/homepage/homepage-builder.tsx` (already links to it via Step 1's `<a href="/admin/homepage/preview">` — no further change needed there)

`src/app/admin/(panel)/layout.tsx` wraps every route under the `(panel)` group in `<AdminShell sidebar={<Sidebar .../>}>`. An iframe (or new tab) pointing at a route *inside* that group would render the admin sidebar, which is wrong for a "what will the public see" preview. Since Next.js route groups only affect which routes share a layout — they don't block a literal path segment from also existing outside the group — creating `src/app/admin/homepage/preview/page.tsx` as a sibling to (not nested inside) `src/app/admin/(panel)/homepage/` gives `/admin/homepage/preview` its own layout-free branch while `/admin/homepage` (the editor) keeps the sidebar. This is the same technique Next.js's own docs recommend for "opt one route out of a shared layout."

**Interfaces:**
- Consumes: `requirePagePermission` (`@/lib/auth/guard`); `loadDraftHomepage`, `resolveHomepageImages` (`@/lib/data/homepage`); `SectionRenderer`; `getSiteSettings`.

- [ ] **Step 1: Write the route**

```tsx
// src/app/admin/homepage/preview/page.tsx
import type { Metadata } from "next";
import { SectionRenderer } from "@/components/homepage/section-renderer";
import { requirePagePermission } from "@/lib/auth/guard";
import { loadDraftHomepage, resolveHomepageImages } from "@/lib/data/homepage";
import { getSiteSettings } from "@/lib/data/site";

export const metadata: Metadata = { title: "Homepage preview", robots: { index: false, follow: false } };

export default async function HomepagePreviewPage() {
  await requirePagePermission("homepage.edit");
  const draft = await loadDraftHomepage();
  const [site, images] = await Promise.all([getSiteSettings(), resolveHomepageImages(draft.sections)]);
  return (
    <div className="min-h-screen bg-night text-frost">
      <div className="sticky top-0 z-10 bg-amber/10 px-4 py-2 text-center text-xs text-amber">Draft preview — this is not what's currently live.</div>
      <SectionRenderer sections={draft.sections} images={images} socials={site.socials} now={new Date()} timezone={site.timezone} />
    </div>
  );
}
```

This deliberately does **not** import `AdminShell`/`Sidebar` — it has no `layout.tsx` of its own besides whatever the root `src/app/layout.tsx` provides (fonts, `<html>`/`<body>`, global CSS), same minimal wrapping the public `(site)` routes get, so it visually matches what the real homepage will look like.

Renders the **draft**, not the published revision (spec: "live preview iframe... reloading on save" — previewing the published version would defeat the point of a pre-publish preview).

- [ ] **Step 2: Manual check**

Visit `/admin/homepage/preview` directly while signed out — expect a redirect to `/admin/login` (via `requirePagePermission` → `requireUser`). Signed in without `homepage.edit`, expect the 403 view (`forbidden()`). Signed in with `homepage.edit`, expect the sections with no admin sidebar/header — just the amber "draft preview" banner and the page itself. Edit a section in the builder, click Preview again (it opens in a new tab per Task 9's `target="_blank"`, so "reloading on save" means: re-visiting/refreshing that tab shows the latest saved draft — there is no auto-refresh websocket, which matches every other admin surface in this codebase; note this scope limit when reporting rather than silently building a live-reload mechanism nothing else in the project has).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/homepage/preview
git commit -m "feat(homepage): add standalone draft preview route outside the admin shell"
```

---

## Task Group F — About and Contact pages

### Task 14: About and Contact content schemas + actions

**Files:**
- Create: `src/lib/pages/about-schema.ts`
- Create: `src/lib/pages/contact-schema.ts`
- Create: `src/server/actions/page-content.ts`
- Test: `src/lib/pages/about-schema.test.ts`, `src/lib/pages/contact-schema.test.ts`

**Judgment call:** `SiteSettings` already holds `email`, `phone`, `address`, `mapUrl` as the single source of truth (used in Settings and the footer). The Contact *page*'s content is therefore just presentation choices (which of those to show, plus an optional intro line) rather than duplicate data entry — avoids two places to edit the same phone number.

**Interfaces:**
- Produces: `aboutContentSchema`, `type AboutContent = { heading: string; body: string; imageId: string | null }`; `contactContentSchema`, `type ContactContent = { intro: string; showEmail: boolean; showPhone: boolean; showAddress: boolean; showMap: boolean }`; `saveAboutContentAction`, `saveContactContentAction: (prev, formData) => Promise<ActionResult>`.

- [ ] **Step 1: `about-schema.ts`**

```ts
// src/lib/pages/about-schema.ts
import { z } from "zod";

export const aboutContentSchema = z.object({
  heading: z.string().trim().max(80).default(""),
  body: z.string().trim().max(4000).default(""),
  imageId: z.string().nullable().default(null),
});
export type AboutContent = z.infer<typeof aboutContentSchema>;

export const ABOUT_DEFAULTS: AboutContent = { heading: "", body: "", imageId: null };
```

- [ ] **Step 2: `contact-schema.ts`**

```ts
// src/lib/pages/contact-schema.ts
import { z } from "zod";

export const contactContentSchema = z.object({
  intro: z.string().trim().max(500).default(""),
  showEmail: z.boolean().default(true),
  showPhone: z.boolean().default(false),
  showAddress: z.boolean().default(false),
  showMap: z.boolean().default(false),
});
export type ContactContent = z.infer<typeof contactContentSchema>;

export const CONTACT_DEFAULTS: ContactContent = { intro: "", showEmail: true, showPhone: false, showAddress: false, showMap: false };
```

- [ ] **Step 3: Tests**

```ts
// src/lib/pages/about-schema.test.ts
import { describe, expect, it } from "vitest";
import { aboutContentSchema } from "./about-schema";

describe("aboutContentSchema", () => {
  it("fills in defaults for an empty object", () => {
    const result = aboutContentSchema.parse({});
    expect(result).toEqual({ heading: "", body: "", imageId: null });
  });

  it("rejects a body over 4000 characters", () => {
    expect(aboutContentSchema.safeParse({ body: "x".repeat(4001) }).success).toBe(false);
  });
});
```

```ts
// src/lib/pages/contact-schema.test.ts
import { describe, expect, it } from "vitest";
import { contactContentSchema } from "./contact-schema";

describe("contactContentSchema", () => {
  it("defaults to showing only email", () => {
    const result = contactContentSchema.parse({});
    expect(result).toEqual({ intro: "", showEmail: true, showPhone: false, showAddress: false, showMap: false });
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/pages/about-schema.test.ts src/lib/pages/contact-schema.test.ts
```

- [ ] **Step 5: Write the actions**

```ts
// src/server/actions/page-content.ts
"use server";

import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { formDataToObject } from "@/lib/forms-data";
import { aboutContentSchema } from "@/lib/pages/about-schema";
import { contactContentSchema } from "@/lib/pages/contact-schema";
import { getRequestMeta } from "@/lib/request-meta";

export async function saveAboutContentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("pages.manage");
    const input = aboutContentSchema.parse(formDataToObject(formData));
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.pageSetting.upsert({
        where: { key: "ABOUT" },
        create: { key: "ABOUT", navLabel: "About", content: input as Prisma.InputJsonValue },
        update: { content: input as Prisma.InputJsonValue },
      });
      await writeAuditLog(tx, { actor: { id: user.id, name: user.name }, action: "pages.about_updated", target: { type: "PageSetting", id: "ABOUT", label: "About page" }, meta });
    });
    invalidate(TAGS.pages);
    return null;
  });
}

export async function saveContactContentAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("pages.manage");
    const raw = formDataToObject(formData);
    const input = contactContentSchema.parse({ ...raw, showEmail: !!raw.showEmail, showPhone: !!raw.showPhone, showAddress: !!raw.showAddress, showMap: !!raw.showMap });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.pageSetting.upsert({
        where: { key: "CONTACT" },
        create: { key: "CONTACT", navLabel: "Contact", content: input as Prisma.InputJsonValue },
        update: { content: input as Prisma.InputJsonValue },
      });
      await writeAuditLog(tx, { actor: { id: user.id, name: user.name }, action: "pages.contact_updated", target: { type: "PageSetting", id: "CONTACT", label: "Contact page" }, meta });
    });
    invalidate(TAGS.pages);
    return null;
  });
}
```

Checkboxes that are unchecked don't appear in `FormData` at all (same gotcha `src/server/actions/pages.ts`'s `isChecked` helper exists for) — the `!!raw.showEmail` coercion above handles "present with any value → true, absent → false" the same way. Verify `formDataToObject`'s exact behavior for a present-but-unchecked vs. absent checkbox against `src/lib/forms-data.ts` before trusting this coercion; if `formDataToObject` already does something equivalent, simplify to match `pages.ts`'s `isChecked` usage exactly instead of duplicating slightly different logic.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pages/about-schema.ts src/lib/pages/contact-schema.ts src/lib/pages/about-schema.test.ts src/lib/pages/contact-schema.test.ts src/server/actions/page-content.ts
git commit -m "feat(pages): add About/Contact content schemas and save actions"
```

---

### Task 15: About/Contact admin editors + public routes + registry update

**Files:**
- Create: `src/app/admin/(panel)/pages/about/page.tsx`, `about-form.tsx`
- Create: `src/app/admin/(panel)/pages/contact/page.tsx`, `contact-form.tsx`
- Modify: `src/app/admin/(panel)/pages/pages-editor.tsx` (link to the two editors)
- Create: `src/app/(site)/about/page.tsx`
- Create: `src/app/(site)/contact/page.tsx`
- Modify: `src/lib/pages/registry.ts` (`IMPLEMENTED_PAGES`)

**Interfaces:**
- Consumes: `getPageSetting` (`@/lib/data/pages`); `assertPageEnabled`; `useFormAction`, `fieldErrorFor`, `SaveBar` (`@/components/admin/form-state`); `Field`, `describedBy` (`@/components/ui/field`); `Input`, `Textarea`; `Panel` (`@/components/admin/page-header`); `getSiteSettings`; `metadataForPage` (`@/lib/seo`).

- [ ] **Step 1: `IMPLEMENTED_PAGES` update**

```ts
// src/lib/pages/registry.ts — change this one line
export const IMPLEMENTED_PAGES: ReadonlySet<PageKey> = new Set<PageKey>(["HOME", "EVENTS", "SPONSORS", "ABOUT", "CONTACT"]);
```

- [ ] **Step 2: Admin About editor**

```tsx
// src/app/admin/(panel)/pages/about/page.tsx
import type { Metadata } from "next";
import { Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPageSetting } from "@/lib/data/pages";
import { aboutContentSchema, ABOUT_DEFAULTS } from "@/lib/pages/about-schema";
import { AboutForm } from "./about-form";

export const metadata: Metadata = { title: "About page" };

export default async function AboutAdminPage() {
  await requirePagePermission("pages.manage");
  const setting = await getPageSetting("ABOUT");
  const parsed = aboutContentSchema.safeParse(setting?.content);
  const values = parsed.success ? parsed.data : ABOUT_DEFAULTS;
  return (
    <div className="grid gap-6">
      <Panel title="About page" description="Content shown on the public /about page.">
        <AboutForm values={values} />
      </Panel>
    </div>
  );
}
```

(Check `Panel`'s real prop names in `src/components/admin/page-header.tsx` before trusting `title`/`description` here — same caveat as Task 8.)

```tsx
// src/app/admin/(panel)/pages/about/about-form.tsx
"use client";

import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Field, describedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AboutContent } from "@/lib/pages/about-schema";
import { saveAboutContentAction } from "@/server/actions/page-content";

export function AboutForm({ values }: { values: AboutContent }) {
  const { state, pending, onSubmit } = useFormAction(saveAboutContentAction);
  const err = (path: string) => fieldErrorFor(state, path);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Heading" htmlFor="heading" error={err("heading")}>
        <Input id="heading" name="heading" defaultValue={values.heading} maxLength={80} {...describedBy("heading", err("heading"))} />
      </Field>
      <Field label="Body" htmlFor="body" hint="One paragraph per line." error={err("body")}>
        <Textarea id="body" name="body" defaultValue={values.body} rows={10} maxLength={4000} {...describedBy("body", err("body"))} />
      </Field>
      <input type="hidden" name="imageId" value={values.imageId ?? ""} />
      <SaveBar pending={pending} error={fieldErrorFor(state, "_form")} />
    </form>
  );
}
```

(Verify `SaveBar`'s exact prop names against `src/components/admin/form-state.tsx` — `settings-form.tsx` was only partially read during this plan's research; match whatever it actually takes.)

- [ ] **Step 3: Admin Contact editor** (same shape, different fields)

```tsx
// src/app/admin/(panel)/pages/contact/page.tsx
import type { Metadata } from "next";
import { Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { getPageSetting } from "@/lib/data/pages";
import { CONTACT_DEFAULTS, contactContentSchema } from "@/lib/pages/contact-schema";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact page" };

export default async function ContactAdminPage() {
  await requirePagePermission("pages.manage");
  const setting = await getPageSetting("CONTACT");
  const parsed = contactContentSchema.safeParse(setting?.content);
  const values = parsed.success ? parsed.data : CONTACT_DEFAULTS;
  return (
    <div className="grid gap-6">
      <Panel title="Contact page" description="Content shown on the public /contact page. Email, phone, address and map link are edited in Site Settings.">
        <ContactForm values={values} />
      </Panel>
    </div>
  );
}
```

```tsx
// src/app/admin/(panel)/pages/contact/contact-form.tsx
"use client";

import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Field, describedBy } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ContactContent } from "@/lib/pages/contact-schema";
import { saveContactContentAction } from "@/server/actions/page-content";

export function ContactForm({ values }: { values: ContactContent }) {
  const { state, pending, onSubmit } = useFormAction(saveContactContentAction);
  const err = (path: string) => fieldErrorFor(state, path);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Intro" htmlFor="intro" error={err("intro")}>
        <Textarea id="intro" name="intro" defaultValue={values.intro} rows={3} maxLength={500} {...describedBy("intro", err("intro"))} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm text-muted">Show on the page</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showEmail" defaultChecked={values.showEmail} className="accent-leaf" /> Email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showPhone" defaultChecked={values.showPhone} className="accent-leaf" /> Phone
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showAddress" defaultChecked={values.showAddress} className="accent-leaf" /> Address
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showMap" defaultChecked={values.showMap} className="accent-leaf" /> Map link
        </label>
      </fieldset>
      <SaveBar pending={pending} error={fieldErrorFor(state, "_form")} />
    </form>
  );
}
```

- [ ] **Step 4: Link both editors from `pages-editor.tsx`**

Open `src/app/admin/(panel)/pages/pages-editor.tsx` and find the row rendering for each `PAGE_KEYS` entry (from the file structure read earlier in this plan's research: an up/down-arrow reorder list with per-row enabled/nav/SEO fields). Add a conditional "Edit content →" link next to the ABOUT and CONTACT rows only, pointing at `/admin/pages/about` and `/admin/pages/contact` respectively — e.g. `{key === "ABOUT" && <Link href="/admin/pages/about">Edit content</Link>}`. Match the file's existing row-rendering structure exactly (read it fully again at implementation time — this plan's research only confirmed its overall shape, not every prop) rather than restructuring the component.

- [ ] **Step 5: Public About route**

```tsx
// src/app/(site)/about/page.tsx
import { Picture } from "@/components/media/picture";
import { assertPageEnabled } from "@/lib/data/pages";
import { db } from "@/lib/db";
import { aboutContentSchema, ABOUT_DEFAULTS } from "@/lib/pages/about-schema";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("ABOUT", { title: "About us", description: "Who we are and what we build." });
}

export default async function AboutPage() {
  const page = await assertPageEnabled("ABOUT");
  const parsed = aboutContentSchema.safeParse(page.content);
  const content = parsed.success ? parsed.data : ABOUT_DEFAULTS;
  const upload = content.imageId ? await db.upload.findUnique({ where: { id: content.imageId }, select: publicImageSelect }) : null;
  const image = toPublicImage(upload);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1fr] md:items-center lg:px-8">
      <div className="grid gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">{content.heading || page.navLabel}</h1>
        {content.body.split("\n").filter(Boolean).map((para, i) => (
          <p key={i} className="text-lg text-muted">
            {para}
          </p>
        ))}
      </div>
      {image && <Picture image={image} sizes="(min-width: 768px) 480px, 100vw" alt="" className="overflow-hidden rounded-3xl" imgClassName="aspect-[4/3] w-full object-cover" />}
    </div>
  );
}
```

- [ ] **Step 6: Public Contact route**

```tsx
// src/app/(site)/contact/page.tsx
import { assertPageEnabled } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { CONTACT_DEFAULTS, contactContentSchema } from "@/lib/pages/contact-schema";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("CONTACT", { title: "Contact us", description: "Get in touch." });
}

export default async function ContactPage() {
  const [page, site] = await Promise.all([assertPageEnabled("CONTACT"), getSiteSettings()]);
  const parsed = contactContentSchema.safeParse(page.content);
  const content = parsed.success ? parsed.data : CONTACT_DEFAULTS;

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">{page.navLabel}</h1>
      {content.intro && <p className="text-lg text-muted">{content.intro}</p>}
      <dl className="grid gap-3">
        {content.showEmail && site.email && (
          <div>
            <dt className="text-sm text-muted">Email</dt>
            <dd>
              <a href={`mailto:${site.email}`} className="text-leaf hover:underline">
                {site.email}
              </a>
            </dd>
          </div>
        )}
        {content.showPhone && site.phone && (
          <div>
            <dt className="text-sm text-muted">Phone</dt>
            <dd>{site.phone}</dd>
          </div>
        )}
        {content.showAddress && site.address && (
          <div>
            <dt className="text-sm text-muted">Address</dt>
            <dd>{site.address}</dd>
          </div>
        )}
        {content.showMap && site.mapUrl && (
          <div>
            <dt className="text-sm text-muted">Map</dt>
            <dd>
              <a href={site.mapUrl} target="_blank" rel="noopener noreferrer" className="text-leaf hover:underline">
                Open in maps
              </a>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
```

(Verify `metadataForPage`'s exact call signature against `src/lib/seo.ts` — it's used identically in `sponsors/page.tsx`, copy that call shape exactly.)

- [ ] **Step 7: Full quality gate**

```bash
npm run lint && npm run typecheck
npx vitest run src/lib/pages
npm run build
```

- [ ] **Step 8: Manual browser check**

Using an admin session (`scripts/qa-session.mts`): visit `/admin/pages`, confirm ABOUT and CONTACT rows now link to their editors. Fill in About's heading/body, save, visit `/about` — confirm content shows and the page is reachable (not 404). Repeat for Contact with a couple of checkboxes toggled. Then toggle ABOUT's `enabled` off from `/admin/pages` (the existing nav/enable screen) and confirm `/about` now 404s (via `assertPageEnabled`) — this checks `IMPLEMENTED_PAGES` + `isPageLive` are wired correctly together.

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/\(panel\)/pages src/app/\(site\)/about src/app/\(site\)/contact src/lib/pages/registry.ts
git commit -m "feat(pages): add About and Contact editors and public routes"
```

---

## Final Gate (run once, after Task 15)

- [ ] **Step 1: Everything together**

```bash
npm run lint
npm run typecheck
npx vitest run
DATABASE_URL=<g4g-test> npx vitest run src/server
npm run build
```

- [ ] **Step 2: Full desktop + mobile browser QA** covering: homepage editor (all 11 section types addable, editable, reorderable via mouse and keyboard, toggleable, removable), publish + history restore, standalone preview route (signed-out redirect, no-permission 403, correct rendering with no admin chrome), public homepage with a real published mix of sections, About and Contact admin editors and public pages, and the empty-state homepage message before anything is ever published (test this on a **fresh** DB or by manually deleting all `HomepageRevision` rows first, then restoring — do not skip it, it's the one path a "happy path only" pass will never hit naturally once a draft has been created once).

- [ ] **Step 3: Update the phase-status memory note** (not part of the codebase — the assistant's own persistent memory file) to record Phase 4 complete and name Phase 5 (announcements, team, gallery) as next, same as was done at the end of Phase 3.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-12-phase-4-homepage-cms.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in the current session using `executing-plans`, batch execution with checkpoints.
