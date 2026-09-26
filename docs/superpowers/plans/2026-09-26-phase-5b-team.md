# Phase 5b: Team (Terms, Domains, Members) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins manage team terms, domains and members (with square-cropped photos), publish a term as "current," copy a roster forward from the previous term, and show the current team on a public `/team` page grouped by tier and domain, with a `/team/[term]` archive for past published terms — plus switch the homepage's `featured_team` section to a cached, tag-invalidated data loader instead of querying the database directly.

**Architecture:** A pure Zod-schema + grouping/reorder module (`src/lib/team/schema.ts`) defines the term/domain/member shapes and the tier→domain grouping used identically by the admin member list and the public pages, unit-tested with no DB dependency — mirroring `src/lib/homepage/sections/schema.ts` and `src/lib/events/schema.ts`. Server actions for terms, domains and members each follow the exact `runAction`/`writeAuditLog`/`invalidate` transaction pattern already used by `src/server/actions/sponsors.ts` and `src/server/actions/categories.ts`. Ordering (domains globally, members within a term+tier+domain group) uses simple up/down arrow buttons backed by a pure `reorderIds` helper — not dnd-kit, which stays reserved for the homepage section list per the Phase 4 lesson about its SSR hydration requirements. A single cached, tag-invalidated data module (`src/lib/data/team.ts`) serves the current team, the archive list and any specific past year; the homepage's `featured_team` renderer is switched to read through it instead of querying `db` directly.

**Tech Stack:** Next.js 16 App Router, Zod 4, Prisma 7 (`TeamTerm`, `Domain`, `TeamMember` — all three models and the `TeamTier` enum already exist in `prisma/schema.prisma`, **no migration needed**), `react-easy-crop` (already wired into `ImageUploadField` for the `TEAM` purpose, which already has its square-crop variant spec), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-gfg-chapter-platform-design.md` §5 (`TeamTerm`/`Domain`/`TeamMember`), §6 (team photo variants), §9 (page toggles), §14 (routes), §16 (quick action). Executors should read §5's team paragraph and §16 in full before starting.

## Global Constraints

- Spec §5 verbatim: "`TeamTerm` — label ("2026-27"), startYear (unique), isCurrent (exactly one), isPublished." / "`Domain` — name, slug, description?, order (Development, Design, DevOps, AI/ML, Cybersecurity, Content, Marketing, Events)." / "`TeamMember` — termId, name, photoId?, title (free text, e.g. "Chapter Lead"), tier `FACULTY LEAD CORE DOMAIN_LEAD MEMBER`, domainId?, bio?, links Json (linkedin, github, instagram, website, x), featured, order. 'Copy members from previous term' action."
- `TeamTerm`, `Domain`, `TeamMember` and the `TeamTier` enum already exist in `prisma/schema.prisma` (verified: `TeamTerm` at line 499, `Domain` at 511, `TeamTier` at 523, `TeamMember` at 531) — **no `prisma migrate` step anywhere in this plan.**
- The 8 default domains (Development, Design, DevOps, AI/ML, Cybersecurity, Content, Marketing, Events) are **already seeded** idempotently by `DOMAIN_DEFAULTS` in `src/server/seed/defaults.ts` via `db.domain.upsert` in `src/server/seed/run.ts` — **no seed task in this plan.** The test database starts empty (see `src/test/int-setup.ts`: every table is truncated before each test), so integration tests must create their own `Domain`/`TeamTerm` fixtures.
- Permission `team.manage` already exists in `src/lib/rbac/permissions.ts` (group "Content") — do not add new permission keys. `media.upload` (used transitively by the upload endpoint) also already exists.
- Cache tag `TAGS.team` already exists in `src/lib/cache-tags.ts` — do not add a new tag; every team mutation calls `invalidate(TAGS.team)`.
- `PageKey.TEAM` already exists in the `PageKey` enum and is already seeded in `PAGE_DEFAULTS` (`src/server/seed/defaults.ts`, navLabel "Team", route `/team`) — this plan only needs to add `"TEAM"` to `IMPLEMENTED_PAGES` in `src/lib/pages/registry.ts`.
- `UploadPurpose.TEAM` and its variant rule (`PURPOSE_RULES.TEAM` in `src/lib/media/variants.ts`: square crop, min 200×200, widths 200/400/800, AVIF+WebP) already exist, and `/api/admin/uploads` (`src/app/api/admin/uploads/route.ts`) already accepts `purpose=TEAM` (it validates against `IMAGE_PURPOSES`, which includes `"TEAM"`, and only requires the `media.upload` permission — no purpose-specific permission gate to add).
- Every server action must go through `runAction`/`ActionResult` (`src/lib/actions.ts`), use `requirePermission("team.manage")` (actions) or `requirePagePermission("team.manage")` (pages), write an audit entry via `writeAuditLog` (`src/lib/audit.ts`) inside the same transaction as the data change, and call `invalidate(TAGS.team)` after the transaction commits — this is the exact pattern used by every action in `src/server/actions/sponsors.ts` and `src/server/actions/categories.ts`.
- Reordering: newly created and copied rows all start at `order: 0` per their group (Prisma's `@default(0)`), so "swap two rows' order values" does nothing once more than one row shares an order. Every move action must load the **whole group** ordered `[{ order: "asc" }, { name: "asc" }]`, compute the new id sequence with the pure `reorderIds` helper (Task 1), and write every row's `order` as its new 0-based index in one transaction.
- Integration tests copy the exact pattern in `src/server/actions/sponsors.int.test.ts`: `vi.mock("next/headers", () => import("@/test/mocks/next-headers"))`, `vi.mock("next/cache", () => import("@/test/mocks/next-cache"))`, a `vi.mock("next/navigation", ...)` that turns `redirect()` into a throw, a **dynamic** `await import("./<module>")` after the mocks, `signIn({ permissions })` / `formOf()` from `@/test/session`, and `resetMockRequest()` + `cache.revalidateTag.mockClear()` in `beforeEach`. Run with `npm run test:int`.
- Follow the existing Zod style from `src/lib/settings/schema.ts` / `src/lib/events/schema.ts`: `isHttpUrl` (from `@/lib/settings/schema`, already used cross-feature by `src/lib/events/schema.ts`) for link validation, `z.preprocess` for numeric `<input type="number">` fields, `isChecked` (from `@/lib/forms-data`) for checkboxes.
- Reuse existing components/helpers instead of inventing new ones: `ImageUploadField` + `UploadedImage` (`@/components/admin/image-upload-field`), `Picture` (`@/components/media/picture`), `publicImageSelect`/`toPublicImage`/`imageUrl` (`@/lib/media/public-image`), `SocialIcon` (`@/components/site/social-icons` — its `Network` type union already includes `linkedin`, `github`, `instagram`, `x`; team's `website` link renders through the same component's `"custom"` branch), `SaveBar`/`useFormAction`/`fieldErrorFor`/`errorsUnder` (`@/components/admin/form-state`), `ConfirmSubmit` (`@/components/admin/confirm-submit`), `PageHeader`/`Panel` (`@/components/admin/page-header`), `Field`/`describedBy` (`@/components/ui/field`), `Input`/`Select`/`Switch`/`Textarea` (`@/components/ui/*`), `formDataToObject`/`isChecked` (`@/lib/forms-data`), `slugify`/`uniqueSlug` (`@/lib/utils/slug`), `ensureImages`/`updateImageAlt` (`@/server/media/images`), `assertPageEnabled`/`metadataForPage` from `@/lib/data/pages` / `@/lib/seo`.
- Shared files also touched by sibling plans (5a runs before this plan, 5c runs after): `src/components/admin/nav-items.ts`, `src/components/admin/quick-actions.ts`, `src/lib/audit-labels.ts`, `src/lib/pages/registry.ts` (`IMPLEMENTED_PAGES`), `src/app/sitemap.ts`. Every edit to these files in Task 12 is described as a surgical, anchored insertion (add this line after that line) — never reproduce or replace the whole file, since 5a's edits will already be present when this plan runs.
- `SaveBar` takes exactly `{ state, pending, label?, savedMessage? }` — it has no `error` prop (verified: `src/components/admin/form-state.tsx`). `Button` has no `asChild` prop (verified: `src/components/ui/button.tsx`, a plain `<button>` wrapper). `PageHeader` requires `eyebrow` (verified: `src/components/admin/page-header.tsx`).
- Numeric text inputs (`startYear`, `order`) are guarded in Zod with `z.preprocess((v) => (v === "" || v == null ? <default> : Number(v)), z.number()...)`, never a bare `Number(e.target.value)` in the client.
- `react/no-unescaped-entities` — use `&apos;`. No synchronous `setState` inside `useEffect`.
- AGENTS.md: this Next.js version has breaking changes from your training data. Every Next API this plan uses (`PageProps<"...">`, `generateMetadata`, `notFound`, `redirect`, route handlers, `unstable_cache`) is copied from files already working in this codebase (cited per task) — do not introduce a Next API that isn't already used elsewhere.
- Final gate (Task 13): `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run test:int`, `npm run build`.

---

## File Structure

```
src/lib/team/
  schema.ts        # TEAM_TIERS/TEAM_TIER_LABELS, teamLinksSchema, teamTermSchema, teamDomainSchema,
                    # teamMemberSchema, TeamMemberDTO type, groupByTier, groupByDomain, reorderIds,
                    # teamMemberLinkList (pure, no db/server-only imports)
  schema.test.ts    # unit tests for all of the above

src/lib/data/team.ts        # getCurrentTeam (cached, TAGS.team), getTeamArchive (cached), getPublicTeamByYear (cached per year)
src/lib/data/team.int.test.ts

src/server/actions/team-domains.ts       # saveDomainAction, deleteDomainAction, moveDomainAction
src/server/actions/team-domains.int.test.ts
src/server/actions/team-terms.ts         # saveTeamTermAction, setCurrentTeamTermAction, deleteTeamTermAction
src/server/actions/team-terms.int.test.ts
src/server/actions/team-members.ts       # saveTeamMemberAction, deleteTeamMemberAction, moveTeamMemberAction, copyTeamMembersFromPreviousTermAction
src/server/actions/team-members.int.test.ts

src/app/admin/(panel)/team/
  page.tsx                # terms + domains admin screen
  term-forms.tsx           # NewTeamTermForm, TeamTermRow (client)
  domain-forms.tsx         # DomainForm (client, add/rename/move/delete)
  [termId]/
    page.tsx                # members grouped by tier/domain + copy-from-previous panel
    member-list.tsx          # MemberGroupList (client: move up/down, delete, edit link)
    copy-term-form.tsx       # CopyTermForm (client)
    member-form.tsx          # MemberForm, DeleteMemberForm (client, shared by new/[id])
    new/page.tsx
    [id]/page.tsx

src/components/site/team/team-groups.tsx   # TeamGroups + MemberCard (public renderer, tier→domain)

src/app/(site)/team/
  page.tsx                  # current published term + archive links
  [term]/page.tsx            # one past published term, by startYear

src/components/homepage/sections/featured-team.tsx   # MODIFIED: reads getCurrentTeam() instead of db.teamMember.findMany

src/components/admin/nav-items.ts       # MODIFIED: + Team nav row
src/components/admin/quick-actions.ts   # MODIFIED: + "Add team member" quick action
src/lib/audit-labels.ts                 # MODIFIED: + team.* labels and the "team" family
src/lib/pages/registry.ts               # MODIFIED: IMPLEMENTED_PAGES gains "TEAM"
src/app/sitemap.ts                      # MODIFIED: + past published team terms
```

**Why this layout:** `lib/team/schema.ts` mirrors `lib/homepage/sections/schema.ts` and `lib/events/schema.ts` — one small pure package holding every shape and pure helper the rest of the feature needs, unit-tested without a database. `TeamMemberDTO` is defined once there and reused by both the admin member list (`admin/team/[termId]/page.tsx`) and the public data loader (`lib/data/team.ts` re-exports it as `PublicTeamMember`) so grouping logic and member shape never drift apart. `team-groups.tsx` is shared by both public routes so the tier/domain rendering exists in exactly one place. Actions are split into three files (domains, terms, members) because each has its own group of unrelated failure modes (slug/order for domains, exactly-one-current for terms, group-based reordering and copy for members) — matching how Phase 2 split `categories.ts` out from `events.ts`.

---

### Task 1: Team schema, grouping and reorder module

**Files:**
- Create: `src/lib/team/schema.ts`
- Test: `src/lib/team/schema.test.ts`

**Interfaces:**
- Consumes: `isHttpUrl` (`@/lib/settings/schema`), `isChecked` (`@/lib/forms-data`), `type PublicImage` (`@/lib/media/public-image`, type-only import).
- Produces: `TEAM_TIERS`, `TEAM_TIER_LABELS`, `teamLinksSchema`, `type TeamLinks`, `teamTermSchema`, `teamDomainSchema`, `teamMemberSchema`, `type TeamTier`, `type TeamMemberDTO`, `groupByTier(members): { tier: TeamTier; label: string; members: TeamMemberDTO[] }[]`, `groupByDomain(members): { domain: { id: string; name: string } | null; members: TeamMemberDTO[] }[]`, `reorderIds(ids: readonly string[], id: string, direction: -1 | 1): string[] | null`, `type TeamLinkItem`, `teamMemberLinkList(links: TeamLinks): TeamLinkItem[]`.

- [ ] **Step 1: Write the schema/grouping module**

```ts
// src/lib/team/schema.ts
import { z } from "zod";
import { isChecked } from "@/lib/forms-data";
import type { PublicImage } from "@/lib/media/public-image";
import { isHttpUrl } from "@/lib/settings/schema";

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || isHttpUrl(v), "Use a full link that starts with https://.")
  .default("");

export const TEAM_TIERS = ["FACULTY", "LEAD", "CORE", "DOMAIN_LEAD", "MEMBER"] as const;
export type TeamTier = (typeof TEAM_TIERS)[number];

export const TEAM_TIER_LABELS: Record<TeamTier, string> = {
  FACULTY: "Faculty",
  LEAD: "Chapter lead",
  CORE: "Core team",
  DOMAIN_LEAD: "Domain lead",
  MEMBER: "Member",
};

export const teamLinksSchema = z.object({
  linkedin: optionalUrl,
  github: optionalUrl,
  instagram: optionalUrl,
  website: optionalUrl,
  x: optionalUrl,
});
export type TeamLinks = z.infer<typeof teamLinksSchema>;

const idField = z
  .string()
  .nullish()
  .transform((v) => v || null);

export const teamTermSchema = z.object({
  id: idField,
  label: text(40).min(1, "Give the term a label, e.g. 2026-27."),
  startYear: z.preprocess(
    (v) => (v === "" || v == null ? NaN : Number(v)),
    z.number().int().min(2000, "Enter a year from 2000 to 2100.").max(2100, "Enter a year from 2000 to 2100."),
  ),
});

export const teamDomainSchema = z.object({
  id: idField,
  name: text(40).min(2, "Name the domain."),
});

export const teamMemberSchema = z.object({
  id: idField,
  termId: z.string().min(1),
  name: text(80).min(1, "Enter the member's name."),
  photoId: idField,
  title: text(60).min(1, "Give them a title, e.g. Chapter Lead."),
  tier: z.enum(TEAM_TIERS).default("MEMBER"),
  domainId: idField,
  bio: z.string().trim().max(600, "Keep the bio under 600 characters.").default(""),
  links: teamLinksSchema.default({}),
  featured: z.unknown().optional().transform(isChecked),
  order: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(9999)),
});

export type TeamMemberDTO = {
  id: string;
  name: string;
  title: string;
  tier: TeamTier;
  bio: string;
  featured: boolean;
  order: number;
  links: TeamLinks;
  photo: PublicImage | null;
  domain: { id: string; name: string; order: number } | null;
};

function byOrder(a: TeamMemberDTO, b: TeamMemberDTO): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

/** One group per non-empty tier, in tier-priority order. */
export function groupByTier(members: readonly TeamMemberDTO[]): { tier: TeamTier; label: string; members: TeamMemberDTO[] }[] {
  return TEAM_TIERS.map((tier) => ({
    tier,
    label: TEAM_TIER_LABELS[tier],
    members: members.filter((m) => m.tier === tier).sort(byOrder),
  })).filter((g) => g.members.length > 0);
}

/** Groups by domain order, with domainless members in a trailing "Other" group. */
export function groupByDomain(members: readonly TeamMemberDTO[]): { domain: { id: string; name: string } | null; members: TeamMemberDTO[] }[] {
  const withDomain = [...members.filter((m) => m.domain)].sort((a, b) => a.domain!.order - b.domain!.order || byOrder(a, b));
  const withoutDomain = [...members.filter((m) => !m.domain)].sort(byOrder);

  const groups: { domain: { id: string; name: string } | null; members: TeamMemberDTO[] }[] = [];
  for (const m of withDomain) {
    const last = groups.at(-1);
    if (last && last.domain?.id === m.domain!.id) last.members.push(m);
    else groups.push({ domain: { id: m.domain!.id, name: m.domain!.name }, members: [m] });
  }
  if (withoutDomain.length > 0) groups.push({ domain: null, members: withoutDomain });
  return groups;
}

/** Moves the id at `direction` (-1 up, +1 down); returns null when there's nowhere to move. */
export function reorderIds(ids: readonly string[], id: string, direction: -1 | 1): string[] | null {
  const index = ids.indexOf(id);
  const to = index + direction;
  if (index === -1 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export type TeamLinkItem = { key: string; network: "linkedin" | "github" | "instagram" | "x" | "custom"; label: string; url: string };

/** Non-empty links in a fixed display order; `website` renders through SocialIcon's "custom" branch. */
export function teamMemberLinkList(links: TeamLinks): TeamLinkItem[] {
  const out: TeamLinkItem[] = [];
  if (links.linkedin) out.push({ key: "linkedin", network: "linkedin", label: "LinkedIn", url: links.linkedin });
  if (links.github) out.push({ key: "github", network: "github", label: "GitHub", url: links.github });
  if (links.instagram) out.push({ key: "instagram", network: "instagram", label: "Instagram", url: links.instagram });
  if (links.x) out.push({ key: "x", network: "x", label: "X", url: links.x });
  if (links.website) out.push({ key: "website", network: "custom", label: "Website", url: links.website });
  return out;
}
```

- [ ] **Step 2: Write unit tests**

```ts
// src/lib/team/schema.test.ts
import { describe, expect, it } from "vitest";
import {
  groupByDomain,
  groupByTier,
  reorderIds,
  teamDomainSchema,
  teamLinksSchema,
  teamMemberLinkList,
  teamMemberSchema,
  teamTermSchema,
  type TeamMemberDTO,
} from "./schema";

describe("teamTermSchema", () => {
  it("accepts a valid term and coerces the year to a number", () => {
    const result = teamTermSchema.safeParse({ label: "2026-27", startYear: "2026" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.startYear).toBe(2026);
  });

  it("rejects a year out of range", () => {
    expect(teamTermSchema.safeParse({ label: "x", startYear: "1900" }).success).toBe(false);
  });
});

describe("teamDomainSchema", () => {
  it("requires at least 2 characters", () => {
    expect(teamDomainSchema.safeParse({ name: "A" }).success).toBe(false);
  });
});

describe("teamLinksSchema", () => {
  it("rejects a non-https link", () => {
    expect(teamLinksSchema.safeParse({ linkedin: "javascript:alert(1)" }).success).toBe(false);
  });

  it("defaults every link to an empty string", () => {
    expect(teamLinksSchema.parse({})).toEqual({ linkedin: "", github: "", instagram: "", website: "", x: "" });
  });
});

describe("teamMemberSchema", () => {
  it("normalises an empty domainId to null and coerces order", () => {
    const result = teamMemberSchema.parse({ termId: "t1", name: "A", title: "Lead", tier: "LEAD", domainId: "", links: {}, order: "3" });
    expect(result.domainId).toBeNull();
    expect(result.order).toBe(3);
  });

  it("treats an absent checkbox as not featured", () => {
    const result = teamMemberSchema.parse({ termId: "t1", name: "A", title: "Lead", tier: "LEAD", links: {}, order: "0" });
    expect(result.featured).toBe(false);
  });
});

describe("reorderIds", () => {
  it("swaps with the next id", () => {
    expect(reorderIds(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });

  it("swaps with the previous id", () => {
    expect(reorderIds(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
  });

  it("returns null when moving the first id up", () => {
    expect(reorderIds(["a", "b"], "a", -1)).toBeNull();
  });

  it("returns null when moving the last id down", () => {
    expect(reorderIds(["a", "b"], "b", 1)).toBeNull();
  });

  it("returns null for an id that isn't in the list", () => {
    expect(reorderIds(["a", "b"], "z", 1)).toBeNull();
  });
});

function member(overrides: Partial<TeamMemberDTO>): TeamMemberDTO {
  return {
    id: "m1",
    name: "A",
    title: "Member",
    tier: "MEMBER",
    bio: "",
    featured: false,
    order: 0,
    links: { linkedin: "", github: "", instagram: "", website: "", x: "" },
    photo: null,
    domain: null,
    ...overrides,
  };
}

describe("groupByTier", () => {
  it("orders groups by tier priority and drops empty tiers", () => {
    const groups = groupByTier([member({ id: "1", tier: "MEMBER" }), member({ id: "2", tier: "LEAD" })]);
    expect(groups.map((g) => g.tier)).toEqual(["LEAD", "MEMBER"]);
  });

  it("sorts members within a tier by order then name", () => {
    const [group] = groupByTier([
      member({ id: "1", name: "Zed", order: 0, tier: "CORE" }),
      member({ id: "2", name: "Amy", order: 0, tier: "CORE" }),
    ]);
    expect(group.members.map((m) => m.name)).toEqual(["Amy", "Zed"]);
  });
});

describe("groupByDomain", () => {
  it("groups by domain order and puts domainless members in a trailing group", () => {
    const groups = groupByDomain([
      member({ id: "1", domain: { id: "d2", name: "Design", order: 1 } }),
      member({ id: "2", domain: null }),
      member({ id: "3", domain: { id: "d1", name: "Development", order: 0 } }),
    ]);
    expect(groups.map((g) => g.domain?.name ?? "other")).toEqual(["Development", "Design", "other"]);
  });
});

describe("teamMemberLinkList", () => {
  it("lists only the filled links in a fixed order", () => {
    const list = teamMemberLinkList({ linkedin: "https://linkedin.com/in/x", github: "", instagram: "", website: "https://x.dev", x: "" });
    expect(list.map((l) => l.key)).toEqual(["linkedin", "website"]);
    expect(list[1]).toMatchObject({ network: "custom", label: "Website" });
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npx vitest run src/lib/team/schema.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/team/schema.ts src/lib/team/schema.test.ts
git commit -m "feat(team): add team schema, grouping and reorder helpers"
```

---

### Task 2: Domain server actions

**Files:**
- Create: `src/server/actions/team-domains.ts`
- Test: `src/server/actions/team-domains.int.test.ts`

**Interfaces:**
- Consumes: `runAction`, `ActionResult` (`@/lib/actions`); `writeAuditLog` (`@/lib/audit`); `requirePermission` (`@/lib/auth/guard`); `TAGS`, `invalidate` (`@/lib/cache-tags`); `db` (`@/lib/db`); `UserError` (`@/lib/errors`); `teamDomainSchema`, `reorderIds` (`@/lib/team/schema`, Task 1); `slugify`, `uniqueSlug` (`@/lib/utils/slug`); `getRequestMeta` (`@/lib/request-meta`).
- Produces: `saveDomainAction(prev, formData): Promise<ActionResult>`, `deleteDomainAction(prev, formData): Promise<ActionResult>`, `moveDomainAction(prev, formData): Promise<ActionResult>`.

- [ ] **Step 1: Write the actions**

```ts
// src/server/actions/team-domains.ts
"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request-meta";
import { reorderIds, teamDomainSchema } from "@/lib/team/schema";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

export async function saveDomainAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const input = teamDomainSchema.parse(Object.fromEntries(formData));
    const existing = input.id ? await db.domain.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That domain no longer exists.");
    const slug = await uniqueSlug(slugify(input.name), async (s) => {
      const hit = await db.domain.findUnique({ where: { slug: s }, select: { id: true } });
      return Boolean(hit && hit.id !== existing?.id);
    });
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      const order = existing ? existing.order : await tx.domain.count();
      const saved = existing
        ? await tx.domain.update({ where: { id: existing.id }, data: { name: input.name, slug } })
        : await tx.domain.create({ data: { name: input.name, slug, order } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "team.domain_updated" : "team.domain_created",
        target: { type: "Domain", id: saved.id, label: saved.name },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}

export async function deleteDomainAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const domain = await db.domain.findUnique({
      where: { id: String(formData.get("id") ?? "") },
      include: { _count: { select: { members: true } } },
    });
    if (!domain) throw new UserError("That domain no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.domain.delete({ where: { id: domain.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.domain_deleted",
        target: { type: "Domain", id: domain.id, label: domain.name },
        metadata: { unassignedMembers: domain._count.members },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}

export async function moveDomainAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const direction = formData.get("direction") === "-1" ? -1 : 1;
    const domains = await db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
    const reordered = reorderIds(
      domains.map((d) => d.id),
      id,
      direction,
    );
    if (!reordered) throw new UserError("That domain can't move further in this list.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await Promise.all(reordered.map((domainId, index) => tx.domain.update({ where: { id: domainId }, data: { order: index } })));
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.domain_moved",
        target: { type: "Domain", id, label: domains.find((d) => d.id === id)?.name ?? "" },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}
```

- [ ] **Step 2: Write integration tests**

```ts
// src/server/actions/team-domains.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { deleteDomainAction, moveDomainAction, saveDomainAction } = await import("./team-domains");

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("domain actions", () => {
  it("requires team.manage", async () => {
    await signIn({ permissions: ["sponsors.manage"] });
    expect(await saveDomainAction(undefined, formOf({ name: "Robotics" }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
  });

  it("creates domains appended to the end, renames, reorders and deletes with audit and cache refresh", async () => {
    await signIn({ permissions: ["team.manage"] });
    expect(await saveDomainAction(undefined, formOf({ name: "Development" }))).toEqual({ ok: true, data: null });
    expect(await saveDomainAction(undefined, formOf({ name: "Design" }))).toEqual({ ok: true, data: null });
    const dev = await db.domain.findFirstOrThrow({ where: { name: "Development" } });
    const design = await db.domain.findFirstOrThrow({ where: { name: "Design" } });
    expect(dev.order).toBe(0);
    expect(design.order).toBe(1);
    expect(cache.revalidateTag).toHaveBeenCalledWith("team", { expire: 0 });

    expect(await moveDomainAction(undefined, formOf({ id: design.id, direction: "-1" }))).toEqual({ ok: true, data: null });
    expect((await db.domain.findUniqueOrThrow({ where: { id: design.id } })).order).toBe(0);
    expect((await db.domain.findUniqueOrThrow({ where: { id: dev.id } })).order).toBe(1);

    expect(await saveDomainAction(undefined, formOf({ id: dev.id, name: "Dev & Infra" }))).toEqual({ ok: true, data: null });
    expect((await db.domain.findUniqueOrThrow({ where: { id: dev.id } })).name).toBe("Dev & Infra");

    expect(await deleteDomainAction(undefined, formOf({ id: dev.id }))).toEqual({ ok: true, data: null });
    expect(await db.domain.count()).toBe(1);
    expect(await db.auditLog.count({ where: { action: { startsWith: "team.domain_" } } })).toBe(5);
  });

  it("refuses to move the only domain in either direction", async () => {
    await signIn({ permissions: ["team.manage"] });
    await saveDomainAction(undefined, formOf({ name: "Solo" }));
    const only = await db.domain.findFirstOrThrow({ where: { name: "Solo" } });
    expect(await moveDomainAction(undefined, formOf({ id: only.id, direction: "-1" }))).toMatchObject({ ok: false });
    expect(await moveDomainAction(undefined, formOf({ id: only.id, direction: "1" }))).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 3: Run the integration tests**

```bash
npm run test:int -- src/server/actions/team-domains.int.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/team-domains.ts src/server/actions/team-domains.int.test.ts
git commit -m "feat(team): add domain CRUD and reorder actions"
```

---

### Task 3: Team term server actions

**Files:**
- Create: `src/server/actions/team-terms.ts`
- Test: `src/server/actions/team-terms.int.test.ts`

**Interfaces:**
- Consumes: same base helpers as Task 2, plus `isChecked` (`@/lib/forms-data`), `teamTermSchema` (`@/lib/team/schema`).
- Produces: `saveTeamTermAction(prev, formData): Promise<ActionResult>`, `setCurrentTeamTermAction(prev, formData): Promise<ActionResult>`, `deleteTeamTermAction(prev, formData): Promise<ActionResult>` (redirects to `/admin/team?deleted=1` on success, like `deleteSponsorAction`).

Rules this task encodes exactly:
- The very first term ever created becomes current automatically (so the admin never lands on an empty "no current term" public page).
- `saveTeamTermAction` never sets `isCurrent` — only `setCurrentTeamTermAction` does, in one transaction: flip every row's `isCurrent` to `false`, then flip the target to `true`.
- A duplicate `startYear` is pre-checked and returned as `fieldErrors.startYear` (not left to surface as a raw Prisma `P2002`, which `runAction` would otherwise report as "Something went wrong").
- Deleting the current term is refused with a `UserError`.

- [ ] **Step 1: Write the actions**

```ts
// src/server/actions/team-terms.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { isChecked } from "@/lib/forms-data";
import { getRequestMeta } from "@/lib/request-meta";
import { teamTermSchema } from "@/lib/team/schema";

const termFormSchema = teamTermSchema.extend({ isPublished: z.unknown().optional().transform(isChecked) });

export async function saveTeamTermAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const input = termFormSchema.parse(Object.fromEntries(formData));
    const existing = input.id ? await db.teamTerm.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That term no longer exists.");
    const clash = await db.teamTerm.findUnique({ where: { startYear: input.startYear } });
    if (clash && clash.id !== existing?.id) {
      throw new UserError("A term with that start year already exists.", {
        startYear: ["A term with that start year already exists."],
      });
    }
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      const isFirstTerm = !existing && (await tx.teamTerm.count()) === 0;
      const saved = existing
        ? await tx.teamTerm.update({
            where: { id: existing.id },
            data: { label: input.label, startYear: input.startYear, isPublished: input.isPublished },
          })
        : await tx.teamTerm.create({
            data: { label: input.label, startYear: input.startYear, isPublished: input.isPublished, isCurrent: isFirstTerm },
          });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "team.term_updated" : "team.term_created",
        target: { type: "TeamTerm", id: saved.id, label: saved.label },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}

export async function setCurrentTeamTermAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const term = await db.teamTerm.findUnique({ where: { id } });
    if (!term) throw new UserError("That term no longer exists.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.teamTerm.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      await tx.teamTerm.update({ where: { id }, data: { isCurrent: true } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.term_current_changed",
        target: { type: "TeamTerm", id: term.id, label: term.label },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath("/admin/team");
    return null;
  });
}

export async function deleteTeamTermAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const term = await db.teamTerm.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
    if (!term) throw new UserError("That term no longer exists.");
    if (term.isCurrent) throw new UserError("You can't delete the current term. Set another term as current first.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.teamTerm.delete({ where: { id: term.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.term_deleted",
        target: { type: "TeamTerm", id: term.id, label: term.label },
        metadata: { removedMembers: term._count.members },
        meta,
      });
    });
    invalidate(TAGS.team);
    return null;
  });
  if (result.ok) redirect("/admin/team?deleted=1");
  return result;
}
```

- [ ] **Step 2: Write integration tests**

```ts
// src/server/actions/team-terms.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { deleteTeamTermAction, saveTeamTermAction, setCurrentTeamTermAction } = await import("./team-terms");

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

describe("team term actions", () => {
  it("requires team.manage", async () => {
    await signIn({ permissions: ["sponsors.manage"] });
    expect(await saveTeamTermAction(undefined, formOf({ label: "2026-27", startYear: "2026" }))).toEqual({
      ok: false,
      error: "You don't have permission to do that.",
    });
  });

  it("makes the first term current automatically, and exactly one term is ever current", async () => {
    await signIn({ permissions: ["team.manage"] });
    expect(await saveTeamTermAction(undefined, formOf({ label: "2025-26", startYear: "2025", isPublished: "on" }))).toEqual({
      ok: true,
      data: null,
    });
    const first = await db.teamTerm.findFirstOrThrow({ where: { startYear: 2025 } });
    expect(first.isCurrent).toBe(true);
    expect(await db.teamTerm.count({ where: { isCurrent: true } })).toBe(1);

    expect(await saveTeamTermAction(undefined, formOf({ label: "2026-27", startYear: "2026", isPublished: "on" }))).toEqual({
      ok: true,
      data: null,
    });
    const second = await db.teamTerm.findFirstOrThrow({ where: { startYear: 2026 } });
    expect(second.isCurrent).toBe(false);
    expect(await db.teamTerm.count({ where: { isCurrent: true } })).toBe(1);

    expect(await setCurrentTeamTermAction(undefined, formOf({ id: second.id }))).toEqual({ ok: true, data: null });
    expect(await db.teamTerm.count({ where: { isCurrent: true } })).toBe(1);
    expect((await db.teamTerm.findUniqueOrThrow({ where: { id: second.id } })).isCurrent).toBe(true);
    expect((await db.teamTerm.findUniqueOrThrow({ where: { id: first.id } })).isCurrent).toBe(false);
    expect(cache.revalidateTag).toHaveBeenCalledWith("team", { expire: 0 });
  });

  it("rejects a duplicate start year as a field error", async () => {
    await signIn({ permissions: ["team.manage"] });
    await saveTeamTermAction(undefined, formOf({ label: "2025-26", startYear: "2025" }));
    expect(await saveTeamTermAction(undefined, formOf({ label: "Another", startYear: "2025" }))).toMatchObject({
      ok: false,
      fieldErrors: { startYear: ["A term with that start year already exists."] },
    });
  });

  it("refuses to delete the current term", async () => {
    await signIn({ permissions: ["team.manage"] });
    await saveTeamTermAction(undefined, formOf({ label: "2025-26", startYear: "2025" }));
    const term = await db.teamTerm.findFirstOrThrow({ where: { startYear: 2025 } });
    expect(await deleteTeamTermAction(undefined, formOf({ id: term.id }))).toMatchObject({
      ok: false,
      error: "You can't delete the current term. Set another term as current first.",
    });
  });

  it("deletes a non-current term and redirects", async () => {
    await signIn({ permissions: ["team.manage"] });
    await saveTeamTermAction(undefined, formOf({ label: "2025-26", startYear: "2025" }));
    await saveTeamTermAction(undefined, formOf({ label: "2026-27", startYear: "2026" }));
    const term = await db.teamTerm.findFirstOrThrow({ where: { startYear: 2026 } });
    await expect(deleteTeamTermAction(undefined, formOf({ id: term.id }))).rejects.toThrow("REDIRECT:/admin/team?deleted=1");
    expect(await db.teamTerm.count()).toBe(1);
  });
});
```

- [ ] **Step 3: Run the integration tests**

```bash
npm run test:int -- src/server/actions/team-terms.int.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/team-terms.ts src/server/actions/team-terms.int.test.ts
git commit -m "feat(team): add team term actions with exactly-one-current enforcement"
```

---

### Task 4: Team member server actions

**Files:**
- Create: `src/server/actions/team-members.ts`
- Test: `src/server/actions/team-members.int.test.ts`

**Interfaces:**
- Consumes: `formDataToObject` (`@/lib/forms-data`, for nested `links.linkedin` etc.), `ensureImages`/`updateImageAlt` (`@/server/media/images`), `teamMemberSchema`/`reorderIds` (`@/lib/team/schema`), `type { Prisma }` (`@/generated/prisma/client`).
- Produces: `saveTeamMemberAction(prev, formData): Promise<ActionResult>` (redirects to `/admin/team/[termId]/[id]?created=1` on create), `deleteTeamMemberAction(prev, formData): Promise<ActionResult>` (redirects to `/admin/team/[termId]?deleted=1`), `moveTeamMemberAction(prev, formData): Promise<ActionResult>`, `copyTeamMembersFromPreviousTermAction(prev, formData): Promise<ActionResult<{ copied: number }>>`.

Copy rule (idempotent by construction): refuses when the target term already has any members, and refuses when there's no earlier term (`startYear` less than the target's) to copy from. A second click after a successful copy always hits the "already has members" refusal, so it can never double the roster.

- [ ] **Step 1: Write the actions**

```ts
// src/server/actions/team-members.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { TAGS, invalidate } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { formDataToObject } from "@/lib/forms-data";
import { getRequestMeta } from "@/lib/request-meta";
import { reorderIds, teamMemberSchema } from "@/lib/team/schema";
import { ensureImages, updateImageAlt } from "@/server/media/images";

export async function saveTeamMemberAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let created: { termId: string; id: string } | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("team.manage");
    const input = teamMemberSchema.parse(formDataToObject(formData));
    const term = await db.teamTerm.findUnique({ where: { id: input.termId } });
    if (!term) throw new UserError("That term no longer exists.");
    const existing = input.id ? await db.teamMember.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new UserError("That member no longer exists.");
    if (input.domainId) {
      const domain = await db.domain.findUnique({ where: { id: input.domainId } });
      if (!domain) throw new UserError("That domain no longer exists.", { domainId: ["That domain no longer exists."] });
    }
    const meta = await getRequestMeta();
    const saved = await db.$transaction(async (tx) => {
      await ensureImages(tx, [input.photoId]);
      const groupChanged = existing && (existing.tier !== input.tier || existing.domainId !== input.domainId);
      const order =
        !existing || groupChanged
          ? await tx.teamMember.count({ where: { termId: input.termId, tier: input.tier, domainId: input.domainId } })
          : existing.order;
      const data = {
        termId: input.termId,
        name: input.name,
        photoId: input.photoId,
        title: input.title,
        tier: input.tier,
        domainId: input.domainId,
        bio: input.bio,
        links: input.links as Prisma.InputJsonValue,
        featured: input.featured,
        order,
      };
      const row = existing ? await tx.teamMember.update({ where: { id: existing.id }, data }) : await tx.teamMember.create({ data });
      await updateImageAlt(tx, input.photoId, formData.get("photoIdAlt"));
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: existing ? "team.member_updated" : "team.member_created",
        target: { type: "TeamMember", id: row.id, label: row.name },
        meta,
      });
      return row;
    });
    invalidate(TAGS.team);
    revalidatePath(`/admin/team/${input.termId}`);
    if (!existing) created = { termId: input.termId, id: saved.id };
    return null;
  });
  if (created) redirect(`/admin/team/${created.termId}/${created.id}?created=1`);
  return result;
}

export async function deleteTeamMemberAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  let termId: string | null = null;
  const result = await runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const member = await db.teamMember.findUnique({ where: { id } });
    if (!member) throw new UserError("That member no longer exists.");
    termId = member.termId;
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.teamMember.delete({ where: { id: member.id } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.member_deleted",
        target: { type: "TeamMember", id: member.id, label: member.name },
        meta,
      });
    });
    invalidate(TAGS.team);
    return null;
  });
  if (result.ok && termId) redirect(`/admin/team/${termId}?deleted=1`);
  return result;
}

export async function moveTeamMemberAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const id = String(formData.get("id") ?? "");
    const direction = formData.get("direction") === "-1" ? -1 : 1;
    const member = await db.teamMember.findUnique({ where: { id } });
    if (!member) throw new UserError("That member no longer exists.");
    const group = await db.teamMember.findMany({
      where: { termId: member.termId, tier: member.tier, domainId: member.domainId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
    const reordered = reorderIds(
      group.map((m) => m.id),
      id,
      direction,
    );
    if (!reordered) throw new UserError("That member can't move further in this list.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await Promise.all(reordered.map((memberId, index) => tx.teamMember.update({ where: { id: memberId }, data: { order: index } })));
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.member_moved",
        target: { type: "TeamMember", id: member.id, label: member.name },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath(`/admin/team/${member.termId}`);
    return null;
  });
}

export async function copyTeamMembersFromPreviousTermAction(
  _prev: ActionResult<{ copied: number }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ copied: number }>> {
  return runAction(async () => {
    const user = await requirePermission("team.manage");
    const termId = String(formData.get("termId") ?? "");
    const target = await db.teamTerm.findUnique({ where: { id: termId }, include: { _count: { select: { members: true } } } });
    if (!target) throw new UserError("That term no longer exists.");
    if (target._count.members > 0) throw new UserError("This term already has members. Copying only works into an empty term.");
    const previous = await db.teamTerm.findFirst({ where: { startYear: { lt: target.startYear } }, orderBy: { startYear: "desc" } });
    if (!previous) throw new UserError("There's no earlier term to copy from.");
    const source = await db.teamMember.findMany({ where: { termId: previous.id }, orderBy: [{ order: "asc" }, { name: "asc" }] });
    if (source.length === 0) throw new UserError("The previous term has no members to copy.");
    const meta = await getRequestMeta();
    await db.$transaction(async (tx) => {
      await tx.teamMember.createMany({
        data: source.map((m) => ({
          termId: target.id,
          name: m.name,
          photoId: m.photoId,
          title: m.title,
          tier: m.tier,
          domainId: m.domainId,
          bio: m.bio,
          links: m.links as Prisma.InputJsonValue,
          featured: m.featured,
          order: m.order,
        })),
      });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name },
        action: "team.member_copied",
        target: { type: "TeamTerm", id: target.id, label: target.label },
        metadata: { fromTerm: previous.label, count: source.length },
        meta,
      });
    });
    invalidate(TAGS.team);
    revalidatePath(`/admin/team/${target.id}`);
    return { copied: source.length };
  });
}
```

- [ ] **Step 2: Write integration tests**

```ts
// src/server/actions/team-members.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as cache from "@/test/mocks/next-cache";
import { resetMockRequest } from "@/test/mocks/state";
import { formOf, signIn } from "@/test/session";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const { copyTeamMembersFromPreviousTermAction, deleteTeamMemberAction, moveTeamMemberAction, saveTeamMemberAction } = await import(
  "./team-members"
);

beforeEach(() => {
  resetMockRequest();
  cache.revalidateTag.mockClear();
});

async function makeTerm(startYear: number, label = `${startYear}`) {
  return db.teamTerm.create({ data: { label, startYear } });
}

describe("team member actions", () => {
  it("requires team.manage", async () => {
    await signIn({ permissions: ["sponsors.manage"] });
    const term = await makeTerm(2026);
    expect(
      await saveTeamMemberAction(undefined, formOf({ termId: term.id, name: "Ada", title: "Lead", tier: "LEAD", order: "0" })),
    ).toEqual({ ok: false, error: "You don't have permission to do that." });
  });

  it("creates, updates and deletes a member with nested links", async () => {
    await signIn({ permissions: ["team.manage"] });
    const term = await makeTerm(2026);
    const created = await saveTeamMemberAction(
      undefined,
      formOf({
        termId: term.id,
        name: "Ada Lovelace",
        title: "Chapter Lead",
        tier: "LEAD",
        order: "0",
        "links.linkedin": "https://linkedin.com/in/ada",
        featured: "on",
      }),
    ).catch((e: Error) => e);
    const id = /REDIRECT:\/admin\/team\/[^/]+\/([^?]+)\?created=1/.exec(String((created as Error).message))?.[1];
    const row = await db.teamMember.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ name: "Ada Lovelace", tier: "LEAD", featured: true });
    expect(row.links).toMatchObject({ linkedin: "https://linkedin.com/in/ada" });
    expect(cache.revalidateTag).toHaveBeenCalledWith("team", { expire: 0 });

    expect(await saveTeamMemberAction(undefined, formOf({ id: id!, termId: term.id, name: "Ada L.", title: "Chapter Lead", tier: "LEAD", order: "0" }))).toEqual(
      { ok: true, data: null },
    );
    expect((await db.teamMember.findUniqueOrThrow({ where: { id } })).name).toBe("Ada L.");

    await expect(deleteTeamMemberAction(undefined, formOf({ id: id! }))).rejects.toThrow(`REDIRECT:/admin/team/${term.id}?deleted=1`);
    expect(await db.teamMember.count()).toBe(0);
  });

  it("reorders within a term+tier+domain group even when every row starts at order 0", async () => {
    await signIn({ permissions: ["team.manage"] });
    const term = await makeTerm(2026);
    const a = await db.teamMember.create({ data: { termId: term.id, name: "Amy", title: "Member", tier: "MEMBER", order: 0 } });
    const b = await db.teamMember.create({ data: { termId: term.id, name: "Bob", title: "Member", tier: "MEMBER", order: 0 } });
    const c = await db.teamMember.create({ data: { termId: term.id, name: "Cid", title: "Member", tier: "MEMBER", order: 0 } });

    expect(await moveTeamMemberAction(undefined, formOf({ id: c.id, direction: "-1" }))).toEqual({ ok: true, data: null });
    const ordered = await db.teamMember.findMany({ where: { termId: term.id }, orderBy: { order: "asc" } });
    expect(ordered.map((m) => m.id)).toEqual([a.id, c.id, b.id]);
    expect(ordered.map((m) => m.order)).toEqual([0, 1, 2]);
  });

  it("copies members from the previous term once, and refuses a second copy or copying with no earlier term", async () => {
    await signIn({ permissions: ["team.manage"] });
    const prev = await makeTerm(2025, "2025-26");
    await db.teamMember.create({ data: { termId: prev.id, name: "Ada", title: "Lead", tier: "LEAD", order: 0 } });
    const target = await makeTerm(2026, "2026-27");

    const copied = await copyTeamMembersFromPreviousTermAction(undefined, formOf({ termId: target.id }));
    expect(copied).toEqual({ ok: true, data: { copied: 1 } });
    expect(await db.teamMember.count({ where: { termId: target.id } })).toBe(1);

    expect(await copyTeamMembersFromPreviousTermAction(undefined, formOf({ termId: target.id }))).toMatchObject({
      ok: false,
      error: "This term already has members. Copying only works into an empty term.",
    });

    const oldest = await makeTerm(2020, "2020-21");
    expect(await copyTeamMembersFromPreviousTermAction(undefined, formOf({ termId: oldest.id }))).toMatchObject({
      ok: false,
      error: "There's no earlier term to copy from.",
    });
  });
});
```

- [ ] **Step 3: Run the integration tests**

```bash
npm run test:int -- src/server/actions/team-members.int.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/team-members.ts src/server/actions/team-members.int.test.ts
git commit -m "feat(team): add member CRUD, group reordering and copy-from-previous-term actions"
```

---

### Task 5: Cached public data loaders

**Files:**
- Create: `src/lib/data/team.ts`
- Test: `src/lib/data/team.int.test.ts`

**Interfaces:**
- Consumes: `TAGS` (`@/lib/cache-tags`), `db` (`@/lib/db`), `publicImageSelect`/`toPublicImage`/`type PublicImage` (`@/lib/media/public-image`), `teamLinksSchema`/`type TeamMemberDTO`/`type TeamTier` (`@/lib/team/schema`, Task 1).
- Produces: `type PublicTeamMember = TeamMemberDTO`, `type PublicTeam = { term: { id: string; label: string; startYear: number }; members: PublicTeamMember[] }`, `getCurrentTeam(): Promise<PublicTeam | null>`, `type ArchiveTermDTO = { id: string; label: string; startYear: number }`, `getTeamArchive(): Promise<ArchiveTermDTO[]>`, `getPublicTeamByYear(startYear: number): Promise<PublicTeam | null>`.

This is the exact per-key cache pattern already used by `getPublicEvent(slug)` in `src/lib/data/events.ts:143-144`: `unstable_cache(() => load(key), ["cache-name", key], { tags: [...] })()`.

- [ ] **Step 1: Write the data module**

```ts
// src/lib/data/team.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { teamLinksSchema, type TeamMemberDTO, type TeamTier } from "@/lib/team/schema";

export type PublicTeamMember = TeamMemberDTO;
export type PublicTeam = { term: { id: string; label: string; startYear: number }; members: PublicTeamMember[] };

const MEMBER_INCLUDE = {
  photo: { select: publicImageSelect },
  domain: { select: { id: true, name: true, order: true } },
} as const;

type MemberRow = {
  id: string;
  name: string;
  title: string;
  tier: TeamTier;
  bio: string;
  featured: boolean;
  order: number;
  links: unknown;
  photo: Parameters<typeof toPublicImage>[0];
  domain: { id: string; name: string; order: number } | null;
};

function toPublicMember(m: MemberRow): PublicTeamMember {
  return {
    id: m.id,
    name: m.name,
    title: m.title,
    tier: m.tier,
    bio: m.bio,
    featured: m.featured,
    order: m.order,
    links: teamLinksSchema.parse(m.links),
    photo: toPublicImage(m.photo),
    domain: m.domain,
  };
}

async function loadTeamByTermId(termId: string, label: string, startYear: number): Promise<PublicTeam> {
  const members = await db.teamMember.findMany({
    where: { termId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: MEMBER_INCLUDE,
  });
  return { term: { id: termId, label, startYear }, members: members.map(toPublicMember) };
}

async function loadCurrentTeamRaw(): Promise<PublicTeam | null> {
  const term = await db.teamTerm.findFirst({ where: { isCurrent: true, isPublished: true } });
  if (!term) return null;
  return loadTeamByTermId(term.id, term.label, term.startYear);
}

/** Cached; invalidated with TAGS.team whenever a term or member changes. */
export const getCurrentTeam = unstable_cache(loadCurrentTeamRaw, ["current-team"], { tags: [TAGS.team] });

export type ArchiveTermDTO = { id: string; label: string; startYear: number };

async function loadTeamArchive(): Promise<ArchiveTermDTO[]> {
  const rows = await db.teamTerm.findMany({ where: { isPublished: true, isCurrent: false }, orderBy: { startYear: "desc" } });
  return rows.map((t) => ({ id: t.id, label: t.label, startYear: t.startYear }));
}

export const getTeamArchive = unstable_cache(loadTeamArchive, ["team-archive"], { tags: [TAGS.team] });

async function loadPublicTeamByYear(startYear: number): Promise<PublicTeam | null> {
  const term = await db.teamTerm.findUnique({ where: { startYear } });
  if (!term || !term.isPublished) return null;
  return loadTeamByTermId(term.id, term.label, term.startYear);
}

/** One cache entry per year; small dataset, so the shared TAGS.team tag is enough (no per-year tag). */
export function getPublicTeamByYear(startYear: number): Promise<PublicTeam | null> {
  return unstable_cache(() => loadPublicTeamByYear(startYear), ["team-year", String(startYear)], { tags: [TAGS.team] })();
}
```

- [ ] **Step 2: Write integration tests**

```ts
// src/lib/data/team.int.test.ts
import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { getCurrentTeam, getPublicTeamByYear, getTeamArchive } = await import("./team");

describe("team data loaders", () => {
  it("returns null when no term is both current and published", async () => {
    await db.teamTerm.create({ data: { label: "2025-26", startYear: 2025, isCurrent: true, isPublished: false } });
    expect(await getCurrentTeam()).toBeNull();
  });

  it("returns the current published term with members sorted by order then name", async () => {
    const term = await db.teamTerm.create({ data: { label: "2026-27", startYear: 2026, isCurrent: true, isPublished: true } });
    await db.teamMember.create({ data: { termId: term.id, name: "Zed", title: "Member", tier: "MEMBER", order: 0 } });
    await db.teamMember.create({ data: { termId: term.id, name: "Amy", title: "Member", tier: "MEMBER", order: 0 } });
    const team = await getCurrentTeam();
    expect(team?.term.label).toBe("2026-27");
    expect(team?.members.map((m) => m.name)).toEqual(["Amy", "Zed"]);
  });

  it("lists only published, non-current terms in the archive, newest first", async () => {
    await db.teamTerm.create({ data: { label: "2024-25", startYear: 2024, isPublished: true } });
    await db.teamTerm.create({ data: { label: "2023-24", startYear: 2023, isPublished: false } });
    await db.teamTerm.create({ data: { label: "2026-27", startYear: 2026, isCurrent: true, isPublished: true } });
    expect((await getTeamArchive()).map((t) => t.startYear)).toEqual([2024]);
  });

  it("serves a specific published year and null for an unpublished or missing one", async () => {
    await db.teamTerm.create({ data: { label: "2024-25", startYear: 2024, isPublished: true } });
    await db.teamTerm.create({ data: { label: "2023-24", startYear: 2023, isPublished: false } });
    expect((await getPublicTeamByYear(2024))?.term.label).toBe("2024-25");
    expect(await getPublicTeamByYear(2023)).toBeNull();
    expect(await getPublicTeamByYear(1999)).toBeNull();
  });
});
```

- [ ] **Step 3: Run the integration tests**

```bash
npm run test:int -- src/lib/data/team.int.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/team.ts src/lib/data/team.int.test.ts
git commit -m "feat(team): add cached current-team, archive and per-year data loaders"
```

---

### Task 6: Switch the homepage's featured_team section to the cached loader

**Files:**
- Modify: `src/components/homepage/sections/featured-team.tsx`

**Interfaces:**
- Consumes: `getCurrentTeam` (`@/lib/data/team`, Task 5).

The current file queries `db.teamMember.findMany` directly with no cache tag, so a team edit never invalidates a served homepage until the 60s time-based revalidate catches up. Switching to `getCurrentTeam()` makes it `revalidateTag(TAGS.team)`-aware immediately, matching every other homepage data-driven section.

- [ ] **Step 1: Replace the component**

```tsx
// src/components/homepage/sections/featured-team.tsx
import { Picture } from "@/components/media/picture";
import { getCurrentTeam } from "@/lib/data/team";
import type { SectionOfType } from "@/lib/homepage/sections/schema";

export async function FeaturedTeamSection({ section }: { section: SectionOfType<"featured_team"> }) {
  const team = await getCurrentTeam();
  const rows = (team?.members ?? []).filter((m) => m.featured).slice(0, section.content.maxItems);
  if (rows.length === 0) return null;
  return (
    <section id={section.anchorId} className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {section.headingOverride && <h2 className="mb-8 text-center font-display text-3xl font-bold">{section.headingOverride}</h2>}
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((m) => (
          <li key={m.id} className="grid gap-2 text-center">
            <div className="mx-auto size-24 overflow-hidden rounded-full bg-tile">
              {m.photo && <Picture image={m.photo} sizes="96px" alt="" imgClassName="size-full object-cover" />}
            </div>
            <p className="font-medium">{m.name}</p>
            <p className="text-xs text-muted">{m.title}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no new errors (the section's prop shape and the homepage renderer that calls it are unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/components/homepage/sections/featured-team.tsx
git commit -m "fix(homepage): make featured_team use the tagged team cache instead of a raw query"
```

---

### Task 7: Admin `/admin/team` — terms and domains

**Files:**
- Create: `src/app/admin/(panel)/team/page.tsx`
- Create: `src/app/admin/(panel)/team/term-forms.tsx`
- Create: `src/app/admin/(panel)/team/domain-forms.tsx`

**Interfaces:**
- Consumes: `saveTeamTermAction`/`setCurrentTeamTermAction`/`deleteTeamTermAction` (Task 3), `saveDomainAction`/`deleteDomainAction`/`moveDomainAction` (Task 2), `PageHeader`/`Panel`, `ConfirmSubmit`, `useFormAction`/`fieldErrorFor`, `Input`, `Button`, `FormMessage`, `requirePagePermission`, `db`.

- [ ] **Step 1: Write `term-forms.tsx`**

```tsx
// src/app/admin/(panel)/team/term-forms.tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { deleteTeamTermAction, saveTeamTermAction, setCurrentTeamTermAction } from "@/server/actions/team-terms";

export function NewTeamTermForm() {
  const { state, pending, onSubmit } = useFormAction(saveTeamTermAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end">
      <div className="grid gap-1">
        <Input name="label" placeholder="e.g. 2026-27" maxLength={40} aria-label="Term label" required />
        <FormMessage>{err("label")}</FormMessage>
      </div>
      <div className="grid gap-1">
        <Input name="startYear" type="number" placeholder="2026" min={2000} max={2100} aria-label="Start year" required />
        <FormMessage>{err("startYear")}</FormMessage>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="isPublished" defaultChecked className="size-3.5 accent-leaf" /> Published
      </label>
      <Button type="submit" disabled={pending}>
        Add term
      </Button>
      {state && !state.ok && !state.fieldErrors && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}

export type TeamTermRowValues = { id: string; label: string; startYear: number; isCurrent: boolean; isPublished: boolean; memberCount: number };

export function TeamTermRow({ term }: { term: TeamTermRowValues }) {
  const { state, pending, onSubmit } = useFormAction(saveTeamTermAction);
  const err = (p: string) => fieldErrorFor(state, p);
  const current = useFormAction(setCurrentTeamTermAction);
  const del = useFormAction(deleteTeamTermAction);

  return (
    <li className="grid gap-2 rounded-xl border border-line bg-surface p-3">
      <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end">
        <input type="hidden" name="id" value={term.id} />
        <div className="grid gap-1">
          <Input name="label" defaultValue={term.label} maxLength={40} aria-label={`Label for ${term.label}`} required />
          <FormMessage>{err("label")}</FormMessage>
        </div>
        <div className="grid gap-1">
          <Input name="startYear" type="number" defaultValue={term.startYear} min={2000} max={2100} aria-label={`Start year for ${term.label}`} required />
          <FormMessage>{err("startYear")}</FormMessage>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="isPublished" defaultChecked={term.isPublished} className="size-3.5 accent-leaf" /> Published
        </label>
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          Save
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/admin/team/${term.id}`} className="inline-flex items-center gap-1 text-leaf hover:underline">
          {term.memberCount} member{term.memberCount === 1 ? "" : "s"} <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        {term.isCurrent ? (
          <span className="rounded-full border border-leaf/40 bg-leaf/10 px-2.5 py-1 text-xs text-leaf">Current term</span>
        ) : (
          <form onSubmit={current.onSubmit}>
            <input type="hidden" name="id" value={term.id} />
            <Button type="submit" variant="ghost" size="sm" disabled={current.pending}>
              Set as current
            </Button>
          </form>
        )}
        {!term.isCurrent && (
          <form onSubmit={del.onSubmit} className="inline-flex items-center gap-2">
            <input type="hidden" name="id" value={term.id} />
            <ConfirmSubmit label="Delete" confirmLabel={`Delete ${term.label}`} variant="ghost" size="sm" disabled={del.pending} />
          </form>
        )}
      </div>
      {del.state && !del.state.ok && <FormMessage>{del.state.error}</FormMessage>}
    </li>
  );
}
```

- [ ] **Step 2: Write `domain-forms.tsx`**

```tsx
// src/app/admin/(panel)/team/domain-forms.tsx
"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { deleteDomainAction, moveDomainAction, saveDomainAction } from "@/server/actions/team-domains";

export function DomainForm({
  id,
  name,
  memberCount,
  isFirst,
  isLast,
}: {
  id?: string;
  name?: string;
  memberCount?: number;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction(saveDomainAction);
  const move = useFormAction(moveDomainAction);
  const del = useFormAction(deleteDomainAction);

  return (
    <div className="flex flex-wrap items-start gap-2">
      {id && (
        <span className="mt-1 flex flex-col">
          <form onSubmit={move.onSubmit}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="direction" value="-1" />
            <button type="submit" aria-label={`Move ${name} up`} disabled={isFirst || move.pending} className="rounded p-1 text-muted hover:text-frost disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
          </form>
          <form onSubmit={move.onSubmit}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="direction" value="1" />
            <button type="submit" aria-label={`Move ${name} down`} disabled={isLast || move.pending} className="rounded p-1 text-muted hover:text-frost disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
          </form>
        </span>
      )}
      <form onSubmit={onSubmit} className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        {id && <input type="hidden" name="id" value={id} />}
        <div className="grid min-w-48 flex-1 gap-1">
          <Input name="name" defaultValue={name} maxLength={40} aria-label={id ? `Rename ${name}` : "New domain name"} placeholder={id ? undefined : "e.g. Development"} required />
          <FormMessage>{fieldErrorFor(state, "name") ?? (state && !state.ok && !state.fieldErrors ? state.error : undefined)}</FormMessage>
        </div>
        <Button type="submit" variant={id ? "secondary" : "primary"} size="sm" disabled={pending} className="mt-1">
          {id ? "Rename" : "Add domain"}
        </Button>
        {state?.ok && <FormMessage tone="success">Saved.</FormMessage>}
      </form>
      {id && (
        <form onSubmit={del.onSubmit} className="mt-1 flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <ConfirmSubmit label="Delete" confirmLabel={memberCount ? `Delete (${memberCount} member${memberCount === 1 ? "" : "s"} lose it)` : "Delete"} variant="ghost" />
          {del.state && !del.state.ok && <FormMessage>{del.state.error}</FormMessage>}
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `page.tsx`**

```tsx
// src/app/admin/(panel)/team/page.tsx
import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { DomainForm } from "./domain-forms";
import { NewTeamTermForm, TeamTermRow } from "./term-forms";

export const metadata: Metadata = { title: "Team" };

export default async function TeamAdminPage() {
  await requirePagePermission("team.manage");
  const [terms, domains] = await Promise.all([
    db.teamTerm.findMany({ orderBy: { startYear: "desc" }, include: { _count: { select: { members: true } } } }),
    db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], include: { _count: { select: { members: true } } } }),
  ]);

  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader eyebrow="Content" title="Team" description="Terms, domains and the members who show up on the Team page." />
      <Panel title="Terms">
        <NewTeamTermForm />
        {terms.length === 0 ? (
          <p className="text-sm text-muted">No terms yet. Add one above.</p>
        ) : (
          <ul className="grid gap-3">
            {terms.map((t) => (
              <TeamTermRow
                key={t.id}
                term={{ id: t.id, label: t.label, startYear: t.startYear, isCurrent: t.isCurrent, isPublished: t.isPublished, memberCount: t._count.members }}
              />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Domains" description="Groups for domain leads and members, e.g. Development, Design.">
        <DomainForm />
        <ul className="grid gap-3">
          {domains.map((d, i) => (
            <li key={d.id}>
              <DomainForm id={d.id} name={d.name} memberCount={d._count.members} isFirst={i === 0} isLast={i === domains.length - 1} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 4: Lint and typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/team/page.tsx" "src/app/admin/(panel)/team/term-forms.tsx" "src/app/admin/(panel)/team/domain-forms.tsx"
git commit -m "feat(team): add admin terms and domains screen"
```

---

### Task 8: Admin `/admin/team/[termId]` — member list and copy-from-previous

**Files:**
- Create: `src/app/admin/(panel)/team/[termId]/page.tsx`
- Create: `src/app/admin/(panel)/team/[termId]/member-list.tsx`
- Create: `src/app/admin/(panel)/team/[termId]/copy-term-form.tsx`

**Interfaces:**
- Consumes: `groupByTier`/`groupByDomain`/`type TeamMemberDTO` (`@/lib/team/schema`, Task 1), `teamLinksSchema` (Task 1), `moveTeamMemberAction`/`deleteTeamMemberAction` (Task 4), `copyTeamMembersFromPreviousTermAction` (Task 4), `publicImageSelect`/`toPublicImage` (`@/lib/media/public-image`).
- Produces: `MemberGroupList({ termId, members }: { termId: string; members: TeamMemberDTO[] })` — consumed here and reused nowhere else, kept as its own component so the grouping page stays readable.

- [ ] **Step 1: Write `member-list.tsx`**

```tsx
// src/app/admin/(panel)/team/[termId]/member-list.tsx
"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { useFormAction } from "@/components/admin/form-state";
import { Picture } from "@/components/media/picture";
import { FormMessage } from "@/components/ui/form-message";
import type { TeamMemberDTO } from "@/lib/team/schema";
import { deleteTeamMemberAction, moveTeamMemberAction } from "@/server/actions/team-members";

export function MemberGroupList({ termId, members }: { termId: string; members: TeamMemberDTO[] }) {
  const move = useFormAction(moveTeamMemberAction);
  const del = useFormAction(deleteTeamMemberAction);

  return (
    <ul className="grid gap-2">
      {members.map((m, i) => (
        <li key={m.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-tile">
            {m.photo && <Picture image={m.photo} sizes="40px" alt="" imgClassName="size-full object-cover" />}
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="flex items-center gap-1.5 truncate font-medium">
              {m.name}
              {m.featured && <Star aria-label="Featured on homepage" className="size-3.5 shrink-0 text-amber" fill="currentColor" />}
            </span>
            <span className="truncate text-sm text-muted">{m.title}</span>
          </span>
          <form onSubmit={move.onSubmit}>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="direction" value="-1" />
            <button type="submit" aria-label={`Move ${m.name} up`} disabled={i === 0} className="rounded p-1.5 text-muted hover:text-frost disabled:opacity-30">
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
          </form>
          <form onSubmit={move.onSubmit}>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="direction" value="1" />
            <button type="submit" aria-label={`Move ${m.name} down`} disabled={i === members.length - 1} className="rounded p-1.5 text-muted hover:text-frost disabled:opacity-30">
              <ArrowDown className="size-4" aria-hidden="true" />
            </button>
          </form>
          <Link href={`/admin/team/${termId}/${m.id}`} className="text-sm text-leaf hover:underline">
            Edit
          </Link>
          <form onSubmit={del.onSubmit}>
            <input type="hidden" name="id" value={m.id} />
            <ConfirmSubmit label="Delete" confirmLabel={`Delete ${m.name}`} variant="ghost" size="sm" disabled={del.pending} />
          </form>
        </li>
      ))}
      {move.state && !move.state.ok && <FormMessage>{move.state.error}</FormMessage>}
      {del.state && !del.state.ok && <FormMessage>{del.state.error}</FormMessage>}
    </ul>
  );
}
```

- [ ] **Step 2: Write `copy-term-form.tsx`**

```tsx
// src/app/admin/(panel)/team/[termId]/copy-term-form.tsx
"use client";

import { Copy } from "lucide-react";
import { useFormAction } from "@/components/admin/form-state";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { copyTeamMembersFromPreviousTermAction } from "@/server/actions/team-members";

export function CopyTermForm({ termId }: { termId: string }) {
  const { state, pending, onSubmit } = useFormAction(copyTeamMembersFromPreviousTermAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-2 rounded-2xl border border-dashed border-line p-4">
      <input type="hidden" name="termId" value={termId} />
      <p className="text-sm text-muted">Start from the previous term&apos;s roster instead of adding everyone by hand.</p>
      <Button type="submit" variant="secondary" size="sm" disabled={pending} className="w-fit">
        <Copy className="size-4" aria-hidden="true" /> Copy members from previous term
      </Button>
      {state?.ok && (
        <FormMessage tone="success">
          Copied {state.data.copied} member{state.data.copied === 1 ? "" : "s"}.
        </FormMessage>
      )}
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
```

- [ ] **Step 3: Write `page.tsx`**

```tsx
// src/app/admin/(panel)/team/[termId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { groupByDomain, groupByTier, teamLinksSchema, type TeamMemberDTO } from "@/lib/team/schema";
import { CopyTermForm } from "./copy-term-form";
import { MemberGroupList } from "./member-list";

export const metadata: Metadata = { title: "Team members" };

export default async function TeamTermPage({ params, searchParams }: PageProps<"/admin/team/[termId]">) {
  await requirePagePermission("team.manage");
  const { termId } = await params;
  const sp = await searchParams;
  const term = await db.teamTerm.findUnique({ where: { id: termId } });
  if (!term) notFound();

  const rows = await db.teamMember.findMany({
    where: { termId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { photo: { select: publicImageSelect }, domain: { select: { id: true, name: true, order: true } } },
  });
  const members: TeamMemberDTO[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    title: m.title,
    tier: m.tier,
    bio: m.bio,
    featured: m.featured,
    order: m.order,
    links: teamLinksSchema.parse(m.links),
    photo: toPublicImage(m.photo),
    domain: m.domain,
  }));
  const tierGroups = groupByTier(members);

  return (
    <div className="grid max-w-5xl gap-8">
      <Link href="/admin/team" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> Terms &amp; domains
      </Link>
      <PageHeader
        eyebrow="Team"
        title={term.label}
        description={`${members.length} member${members.length === 1 ? "" : "s"}${term.isCurrent ? " · Current term" : ""}`}
        actions={
          <Link href={`/admin/team/${term.id}/new`} className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            <Plus className="size-4" aria-hidden="true" /> Add member
          </Link>
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Member deleted.
        </p>
      )}
      {members.length === 0 && <CopyTermForm termId={term.id} />}
      {tierGroups.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">No members yet.</p>
          <Link href={`/admin/team/${term.id}/new`} className="text-sm text-leaf hover:underline">
            Add the first one
          </Link>
        </div>
      ) : (
        tierGroups.map((g) => (
          <section key={g.tier} className="grid gap-3">
            <h2 className="font-display text-lg font-semibold">{g.label}</h2>
            {g.tier === "DOMAIN_LEAD" || g.tier === "MEMBER" ? (
              groupByDomain(g.members).map((dg) => (
                <div key={dg.domain?.id ?? "other"} className="grid gap-2">
                  <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">{dg.domain?.name ?? "No domain"}</p>
                  <MemberGroupList termId={term.id} members={dg.members} />
                </div>
              ))
            ) : (
              <MemberGroupList termId={term.id} members={g.members} />
            )}
          </section>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: Lint and typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/team/[termId]/page.tsx" "src/app/admin/(panel)/team/[termId]/member-list.tsx" "src/app/admin/(panel)/team/[termId]/copy-term-form.tsx"
git commit -m "feat(team): add admin member list grouped by tier and domain, with copy-from-previous-term"
```

---

### Task 9: Admin member create/edit form

**Files:**
- Create: `src/app/admin/(panel)/team/[termId]/member-form.tsx`
- Create: `src/app/admin/(panel)/team/[termId]/new/page.tsx`
- Create: `src/app/admin/(panel)/team/[termId]/[id]/page.tsx`

**Interfaces:**
- Consumes: `saveTeamMemberAction`/`deleteTeamMemberAction` (Task 4), `ImageUploadField`/`type UploadedImage` (`@/components/admin/image-upload-field`), `TEAM_TIERS`/`TEAM_TIER_LABELS`/`type TeamTier`/`teamLinksSchema` (`@/lib/team/schema`), `imageUrl`/`toPublicImage`/`publicImageSelect` (`@/lib/media/public-image`) — the exact `imageUrl(image, 400)` pattern used by `src/app/admin/(panel)/sponsors/[id]/page.tsx:38`.

- [ ] **Step 1: Write `member-form.tsx`**

```tsx
// src/app/admin/(panel)/team/[termId]/member-form.tsx
"use client";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { ImageUploadField, type UploadedImage } from "@/components/admin/image-upload-field";
import { Panel } from "@/components/admin/page-header";
import { Field, describedBy } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TEAM_TIERS, TEAM_TIER_LABELS, type TeamTier } from "@/lib/team/schema";
import { deleteTeamMemberAction, saveTeamMemberAction } from "@/server/actions/team-members";

export type MemberValues = {
  id: string | null;
  name: string;
  photo: UploadedImage | null;
  title: string;
  tier: TeamTier;
  domainId: string;
  bio: string;
  links: { linkedin: string; github: string; instagram: string; website: string; x: string };
  featured: boolean;
  order: number;
};

export function MemberForm({
  term,
  domains,
  values,
}: {
  term: { id: string; label: string };
  domains: { id: string; name: string }[];
  values: MemberValues;
}) {
  const { state, pending, onSubmit } = useFormAction(saveTeamMemberAction);
  const err = (p: string) => fieldErrorFor(state, p);
  return (
    <form onSubmit={onSubmit} className="grid gap-6" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="termId" value={term.id} />
      <Panel title="Details" description={`Added to the ${term.label} term.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" error={err("name")}>
            <Input id="name" name="name" defaultValue={values.name} maxLength={80} required {...describedBy("name", err("name"))} />
          </Field>
          <Field label="Title" htmlFor="title" error={err("title")} hint="e.g. Chapter Lead, Design Domain Lead.">
            <Input id="title" name="title" defaultValue={values.title} maxLength={60} required {...describedBy("title", err("title"))} />
          </Field>
          <Field label="Tier" htmlFor="tier" error={err("tier")}>
            <Select id="tier" name="tier" defaultValue={values.tier}>
              {TEAM_TIERS.map((t) => (
                <option key={t} value={t}>
                  {TEAM_TIER_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Domain" htmlFor="domainId" error={err("domainId")} hint="Used for Domain Lead and Member tiers.">
            <Select id="domainId" name="domainId" defaultValue={values.domainId}>
              <option value="">No domain</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sort order" htmlFor="order" error={err("order")} hint="Lower numbers appear first within their group.">
            <Input id="order" name="order" type="number" min={0} defaultValue={values.order} />
          </Field>
          <Field label="Bio" htmlFor="bio" error={err("bio")} className="sm:col-span-2">
            <Textarea id="bio" name="bio" rows={3} defaultValue={values.bio} maxLength={600} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <Switch name="featured" label="Feature on the homepage" defaultChecked={values.featured} />
        </div>
      </Panel>
      <Panel title="Photo">
        <ImageUploadField name="photoId" purpose="TEAM" label="Team photo" initial={values.photo} />
      </Panel>
      <Panel title="Links">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn" htmlFor="links.linkedin" error={err("links.linkedin")}>
            <Input id="links.linkedin" name="links.linkedin" type="url" defaultValue={values.links.linkedin} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="GitHub" htmlFor="links.github" error={err("links.github")}>
            <Input id="links.github" name="links.github" type="url" defaultValue={values.links.github} placeholder="https://github.com/…" />
          </Field>
          <Field label="Instagram" htmlFor="links.instagram" error={err("links.instagram")}>
            <Input id="links.instagram" name="links.instagram" type="url" defaultValue={values.links.instagram} placeholder="https://instagram.com/…" />
          </Field>
          <Field label="Website" htmlFor="links.website" error={err("links.website")}>
            <Input id="links.website" name="links.website" type="url" defaultValue={values.links.website} placeholder="https://…" />
          </Field>
          <Field label="X" htmlFor="links.x" error={err("links.x")}>
            <Input id="links.x" name="links.x" type="url" defaultValue={values.links.x} placeholder="https://x.com/…" />
          </Field>
        </div>
      </Panel>
      <SaveBar state={state} pending={pending} label={values.id ? "Save member" : "Add member"} />
    </form>
  );
}

export function DeleteMemberForm({ id, name }: { id: string; name: string }) {
  const { state, pending, onSubmit } = useFormAction(deleteTeamMemberAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit label="Delete member" confirmLabel={`Delete ${name}`} disabled={pending} />
      {state && !state.ok && <FormMessage>{state.error}</FormMessage>}
    </form>
  );
}
```

- [ ] **Step 2: Write `new/page.tsx`**

```tsx
// src/app/admin/(panel)/team/[termId]/new/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Add team member" };

export default async function NewTeamMemberPage({ params }: PageProps<"/admin/team/[termId]/new">) {
  await requirePagePermission("team.manage");
  const { termId } = await params;
  const term = await db.teamTerm.findUnique({ where: { id: termId } });
  if (!term) notFound();
  const domains = await db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });

  return (
    <div className="grid max-w-2xl gap-8">
      <Link href={`/admin/team/${term.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> {term.label}
      </Link>
      <PageHeader eyebrow="Team" title="Add member" />
      <MemberForm
        term={{ id: term.id, label: term.label }}
        domains={domains.map((d) => ({ id: d.id, name: d.name }))}
        values={{
          id: null,
          name: "",
          photo: null,
          title: "",
          tier: "MEMBER",
          domainId: "",
          bio: "",
          links: { linkedin: "", github: "", instagram: "", website: "", x: "" },
          featured: false,
          order: 0,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Write `[id]/page.tsx`**

```tsx
// src/app/admin/(panel)/team/[termId]/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { imageUrl, publicImageSelect, toPublicImage } from "@/lib/media/public-image";
import { teamLinksSchema } from "@/lib/team/schema";
import { DeleteMemberForm, MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Edit team member" };

export default async function EditTeamMemberPage({ params, searchParams }: PageProps<"/admin/team/[termId]/[id]">) {
  await requirePagePermission("team.manage");
  const { termId, id } = await params;
  const sp = await searchParams;
  const [term, member, domains] = await Promise.all([
    db.teamTerm.findUnique({ where: { id: termId } }),
    db.teamMember.findUnique({ where: { id }, include: { photo: { select: publicImageSelect } } }),
    db.domain.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }),
  ]);
  if (!term || !member || member.termId !== term.id) notFound();
  const photo = toPublicImage(member.photo);
  const links = teamLinksSchema.parse(member.links);

  return (
    <div className="grid max-w-2xl gap-8">
      <Link href={`/admin/team/${term.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> {term.label}
      </Link>
      <PageHeader eyebrow="Team" title={member.name} />
      {sp.created && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Member added.
        </p>
      )}
      <MemberForm
        term={{ id: term.id, label: term.label }}
        domains={domains.map((d) => ({ id: d.id, name: d.name }))}
        values={{
          id: member.id,
          name: member.name,
          photo: photo ? { id: photo.id, url: imageUrl(photo, 400), alt: photo.alt } : null,
          title: member.title,
          tier: member.tier,
          domainId: member.domainId ?? "",
          bio: member.bio,
          links,
          featured: member.featured,
          order: member.order,
        }}
      />
      <Panel title="Delete member">
        <DeleteMemberForm id={member.id} name={member.name} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 4: Lint and typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(panel)/team/[termId]/member-form.tsx" "src/app/admin/(panel)/team/[termId]/new/page.tsx" "src/app/admin/(panel)/team/[termId]/[id]/page.tsx"
git commit -m "feat(team): add admin member create/edit form with photo upload and links"
```

---

### Task 10: Public team renderer component

**Files:**
- Create: `src/components/site/team/team-groups.tsx`

**Interfaces:**
- Consumes: `groupByTier`/`groupByDomain`/`teamMemberLinkList` (`@/lib/team/schema`, Task 1), `type PublicTeamMember` (`@/lib/data/team`, Task 5), `Picture` (`@/components/media/picture`), `SocialIcon` (`@/components/site/social-icons`).
- Produces: `TeamGroups({ members: PublicTeamMember[] })`, consumed by both public team routes in Task 11.

- [ ] **Step 1: Write the component**

```tsx
// src/components/site/team/team-groups.tsx
import { Picture } from "@/components/media/picture";
import { SocialIcon } from "@/components/site/social-icons";
import type { PublicTeamMember } from "@/lib/data/team";
import { groupByDomain, groupByTier, teamMemberLinkList } from "@/lib/team/schema";

function MemberCard({ member }: { member: PublicTeamMember }) {
  const links = teamMemberLinkList(member.links);
  return (
    <li className="grid gap-3 rounded-2xl border border-line bg-surface p-5 text-center">
      <div className="mx-auto size-24 overflow-hidden rounded-full bg-tile">
        {member.photo && <Picture image={member.photo} sizes="96px" alt="" imgClassName="size-full object-cover" />}
      </div>
      <div className="grid gap-0.5">
        <p className="font-semibold">{member.name}</p>
        <p className="text-sm text-muted">{member.title}</p>
      </div>
      {member.bio && <p className="text-sm text-muted">{member.bio}</p>}
      {links.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${member.name} on ${l.label}`}
              className="grid size-8 place-items-center rounded-full border border-line text-muted hover:text-leaf"
            >
              <SocialIcon network={l.network} className="size-3.5" />
            </a>
          ))}
        </div>
      )}
    </li>
  );
}

/** Renders every non-empty tier in priority order; Domain Lead and Member tiers are subgrouped by domain. */
export function TeamGroups({ members }: { members: PublicTeamMember[] }) {
  const tierGroups = groupByTier(members);
  if (tierGroups.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">No members recorded for this term.</p>
    );
  }
  return (
    <div className="grid gap-14">
      {tierGroups.map((g) => (
        <section key={g.tier} aria-labelledby={`tier-${g.tier}`} className="grid gap-6">
          <h2 id={`tier-${g.tier}`} className="font-display text-2xl font-bold">
            {g.label}
          </h2>
          {g.tier === "DOMAIN_LEAD" || g.tier === "MEMBER" ? (
            <div className="grid gap-10">
              {groupByDomain(g.members).map((dg) => (
                <div key={dg.domain?.id ?? "other"} className="grid gap-4">
                  <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{dg.domain?.name ?? "Other"}</h3>
                  <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {dg.members.map((m) => (
                      <MemberCard key={m.id} member={m} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.members.map((m) => (
                <MemberCard key={m.id} member={m} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors (Task 11 wires this component in; it isn't imported anywhere until then, so typecheck alone verifies the file compiles).

- [ ] **Step 3: Commit**

```bash
git add src/components/site/team/team-groups.tsx
git commit -m "feat(team): add public team-groups renderer (tier then domain)"
```

---

### Task 11: Public `/team` and `/team/[term]` pages

**Files:**
- Create: `src/app/(site)/team/page.tsx`
- Create: `src/app/(site)/team/[term]/page.tsx`

**Interfaces:**
- Consumes: `assertPageEnabled`/`metadataForPage` (already-established pattern, verified against `src/app/(site)/sponsors/page.tsx` and `src/app/(site)/about/page.tsx`), `getCurrentTeam`/`getTeamArchive`/`getPublicTeamByYear` (Task 5), `TeamGroups` (Task 10).

- [ ] **Step 1: Write `/team/page.tsx`**

```tsx
// src/app/(site)/team/page.tsx
import Link from "next/link";
import { TeamGroups } from "@/components/site/team/team-groups";
import { assertPageEnabled } from "@/lib/data/pages";
import { getCurrentTeam, getTeamArchive } from "@/lib/data/team";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("TEAM", { title: "Our team", description: "The students who run the chapter." });
}

export default async function TeamPage() {
  const page = await assertPageEnabled("TEAM");
  const [team, archive] = await Promise.all([getCurrentTeam(), getTeamArchive()]);

  return (
    <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:px-8">
      <header className="grid gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-leaf">{page.navLabel}</p>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">
          {team ? `The people behind ${team.term.label}` : "Meet the team"}
        </h1>
      </header>

      {team ? (
        <TeamGroups members={team.members} />
      ) : (
        <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">
          Our team page is being put together. Check back soon.
        </p>
      )}

      {archive.length > 0 && (
        <section className="grid gap-3 border-t border-line pt-8">
          <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-muted">Past teams</h2>
          <div className="flex flex-wrap gap-2">
            {archive.map((t) => (
              <Link key={t.id} href={`/team/${t.startYear}`} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-leaf/40 hover:text-leaf">
                {t.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `/team/[term]/page.tsx`**

```tsx
// src/app/(site)/team/[term]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TeamGroups } from "@/components/site/team/team-groups";
import { assertPageEnabled } from "@/lib/data/pages";
import { getCurrentTeam, getPublicTeamByYear } from "@/lib/data/team";
import { metadataForPage } from "@/lib/seo";

const YEAR_RE = /^\d{4}$/;

export async function generateMetadata({ params }: PageProps<"/team/[term]">): Promise<Metadata> {
  const { term } = await params;
  if (!YEAR_RE.test(term)) return {};
  const data = await getPublicTeamByYear(Number(term));
  if (!data) return {};
  return metadataForPage("TEAM", { title: `${data.term.label} team`, description: `The chapter's ${data.term.label} team.` });
}

export default async function TeamArchivePage({ params }: PageProps<"/team/[term]">) {
  await assertPageEnabled("TEAM");
  const { term } = await params;
  if (!YEAR_RE.test(term)) notFound();
  const startYear = Number(term);

  const current = await getCurrentTeam();
  if (current?.term.startYear === startYear) redirect("/team");

  const data = await getPublicTeamByYear(startYear);
  if (!data) notFound();

  return (
    <div className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 lg:px-8">
      <header className="grid gap-3">
        <Link href="/team" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-frost">
          <ArrowLeft className="size-4" aria-hidden="true" /> Current team
        </Link>
        <h1 className="max-w-3xl font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-6xl">{data.term.label} team</h1>
      </header>
      <TeamGroups members={data.members} />
    </div>
  );
}
```

- [ ] **Step 3: Lint, typecheck, unit tests**

```bash
npm run lint && npm run typecheck && npx vitest run src/lib/team
```

Expected: no errors, all unit tests pass.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(site)/team/page.tsx" "src/app/(site)/team/[term]/page.tsx"
git commit -m "feat(team): add public /team and /team/[term] pages"
```

---

### Task 12: Wire nav, quick action, audit labels, page registry and sitemap

**Files:**
- Modify: `src/components/admin/nav-items.ts`
- Modify: `src/components/admin/quick-actions.ts`
- Modify: `src/lib/audit-labels.ts`
- Modify: `src/lib/pages/registry.ts`
- Modify: `src/app/sitemap.ts`

Every edit below is a surgical insertion by anchor. **Do not replace the whole file** — 5a (announcements) runs before this plan and will already have added its own lines to each of these files; find the anchor text in the file as it exists when you run this task and insert next to it.

- [ ] **Step 1: `nav-items.ts`** — add `UsersRound` to the `lucide-react` import list (alongside the other icon names already imported there), and add a nav row after the Sponsors row (`{ href: "/admin/sponsors", ... }`):

```ts
{ href: "/admin/team", label: "Team", icon: UsersRound, permission: "team.manage", section: "Content" },
```

- [ ] **Step 2: `quick-actions.ts`** — add `UserRoundPlus` to the `lucide-react` import list, and add a row (position doesn't matter; append after the last existing row):

```ts
{ href: "/admin/team", label: "Add team member", description: "Pick a term, then add someone", icon: UserRoundPlus, permission: "team.manage" },
```

The href is the terms hub, not a specific member form, because "add a member" always requires picking which term first — there's no single static "new member" route.

- [ ] **Step 3: `audit-labels.ts`** — add these entries to the `LABELS` object, next to the existing `"form.responses_exported": "Exported form responses",` line (anywhere inside the object body is fine; grouping them together aids readability):

```ts
"team.term_created": "Added a team term",
"team.term_updated": "Edited a team term",
"team.term_deleted": "Deleted a team term",
"team.term_current_changed": "Set the current team term",
"team.domain_created": "Added a team domain",
"team.domain_updated": "Renamed a team domain",
"team.domain_deleted": "Deleted a team domain",
"team.domain_moved": "Reordered team domains",
"team.member_created": "Added a team member",
"team.member_updated": "Edited a team member",
"team.member_deleted": "Removed a team member",
"team.member_moved": "Reordered team members",
"team.member_copied": "Copied team members from a previous term",
```

and add one family to `AUDIT_ACTION_FAMILIES` (all `team.*` actions share this one family, since the filter matches by `action.startsWith("team.")` — verified in `src/lib/audit-filters.ts:54`):

```ts
{ value: "team", label: "Team" },
```

- [ ] **Step 4: `registry.ts`** — add `"TEAM"` to the array literal passed to `new Set<PageKey>([...])` that defines `IMPLEMENTED_PAGES`. Whatever else 5a has already added to that array, keep it — only add the one string:

```ts
export const IMPLEMENTED_PAGES: ReadonlySet<PageKey> = new Set<PageKey>(["HOME", "EVENTS", "SPONSORS", "ABOUT", "CONTACT", "TEAM"]);
```

- [ ] **Step 5: `sitemap.ts`** — add the import and, after the existing `if (live("EVENTS")) { ... }` block, add a matching block for past team terms:

```ts
import { getTeamArchive } from "@/lib/data/team";
```

```ts
  if (live("TEAM")) {
    for (const t of await getTeamArchive()) {
      entries.push({ url: `${base}/team/${t.startYear}`, changeFrequency: "yearly", priority: 0.4 });
    }
  }
```

(The current team's own `/team` URL is already covered by the top `pages.filter((p) => isPageLive(p))` block, same as every other toggleable page.)

- [ ] **Step 6: Lint, typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/nav-items.ts src/components/admin/quick-actions.ts src/lib/audit-labels.ts src/lib/pages/registry.ts src/app/sitemap.ts
git commit -m "feat(team): wire nav, quick action, audit labels, page registry and sitemap"
```

---

### Task 13: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Unit tests**

```bash
npx vitest run
```

Expected: all pass, including `src/lib/team/schema.test.ts`.

- [ ] **Step 4: Integration tests**

```bash
npm run test:int
```

Expected: all pass, including `team-domains.int.test.ts`, `team-terms.int.test.ts`, `team-members.int.test.ts`, `team.int.test.ts` (data loaders).

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: production build succeeds (this also generates the typed-route definitions `PageProps<"/admin/team/[termId]">` etc. depend on — Step 2 must be re-run if Step 5 changes anything, but it shouldn't).

- [ ] **Step 6: Manual check (optional but recommended)**

Run `npm run dev`, sign in as an account with `team.manage`, and walk through: create a term (becomes current automatically) → add a domain → add two members in the same tier+domain and reorder them with the arrows → upload a team photo and confirm the crop dialog is square → set a second term as current and confirm the first is no longer current → visit `/team` (shows the new current term) and `/team/<oldStartYear>` (shows the old one, current one 404s→redirects) → toggle `TEAM` off in `/admin/pages` and confirm `/team` 404s and disappears from the nav and sitemap.

- [ ] **Step 7: Commit** (only if Step 6 surfaced a fix)

```bash
git add -A
git commit -m "fix(team): address manual verification findings"
```
