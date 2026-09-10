# GfG Student Chapter Platform — Design Spec

Date: 2026-09-10
Status: Approved in brainstorming (theme, logo treatment, architecture, form engine)

The user's original brief is the requirements document. This spec records only the
decisions that brief leaves open: stack details, data model, auth/RBAC, route map,
CMS shape, form engine, visual system, and build order.

---

## 1. Fixed decisions

| Area | Decision |
|---|---|
| App | Next.js (App Router, latest stable) + TypeScript (strict) + Tailwind CSS v4 + Motion (`motion/react`) |
| Data | PostgreSQL + Prisma ORM. Vanilla Postgres only — no extensions. Admin search via `ILIKE` |
| Dev DB | `npx prisma dev` (local Prisma Postgres). Production: regular PostgreSQL server on the VPS |
| Uploads | Local disk under `UPLOAD_DIR` (default `./data/uploads`), **outside `public/`**, served by a route handler |
| Hosting | VPS / self-hosted single Node process (`output: "standalone"`), nginx in front, systemd |
| Rate limiting | In-memory sliding window (single process) |
| Auth | Hand-rolled: DB sessions + argon2id, invite-only admin accounts, super admin bootstrapped from env |
| Identity | Seeded as generic "GeeksforGeeks Student Chapter" / "Your University"; everything editable |
| Timezone | Site setting, default `Asia/Kolkata`. All timestamps stored UTC |
| UI kit (admin) | shadcn/ui (Radix primitives) restyled with project tokens; dnd-kit for ordering; Tiptap for rich text; react-easy-crop for cropping |

## 2. Visual system (approved)

Dark-first "pine night" palette. Same tokens in admin, quieter (no glows).

| Token | Hex | Role |
|---|---|---|
| night | `#08120D` | page ground |
| pine | `#0D1B14` | alternate sections |
| surface | `#112219` | cards, form panes |
| raised | `#172C21` | hover / nested surfaces |
| line | `#23392C` | borders |
| frost | `#E6EFE8` | primary text |
| muted | `#93A89A` | secondary text |
| brand | `#2F8D46` | GfG green: logo, fills, glows |
| leaf | `#5CC97B` | primary buttons, links, live state |
| mint | `#BDF3CB` | small highlights, focus rings |
| amber | `#F2B84B` | Important |
| red | `#F26D6D` | Urgent / cancelled / destructive |
| tile | `#EEF4EF` | logo tile only |

- Type: Bricolage Grotesque 600/800 (display), Geist 400/500/600 (body/UI), Geist Mono (eyebrows, code motifs, counters, URLs). Self-hosted via `next/font/google`.
- **Logo: the original artwork, colours untouched, always on a light tile** (`#EEF4EF`, rounded, faint mint rim, soft green shadow). Large tile in hero/about, 40px tile in nav, tile + name in footer and admin sidebar. Transparent PNG derived from `logo.jpeg` by un-mixing the white background; no other pixel changes. Never recolour the cap or wordmark.
- Motif: two interlocking outline rings (from the double-G) behind heroes and section breaks.
- Green budget: leaf only on actions and live states; max one glow per section.
- Motion: Lenis smooth scroll, Motion entrance/scroll reveals, hero ring-draw + terminal typing + pointer-parallax glow, animated counters, card tilt, gallery shared-layout lightbox, route fade via `template.tsx`. Everything collapses to instant under `prefers-reduced-motion`. Content is visible at rest (no opacity-0 waiting on observers for above-the-fold content).
- Theme reference: `docs/reference/theme-preview.html`.

## 3. Architecture

Single Next.js monolith.

- **Public pages**: Server Components reading through a `lib/data/*` layer. Cached with tag-based invalidation (`revalidateTag`/`updateTag` from mutations) plus a short time-based revalidate (60s) so date-derived statuses stay fresh. Time-sensitive UI (countdowns, "registration closes in") computes client-side from timestamps.
- **Admin mutations**: Server Actions. Every action starts with `requirePermission(...)`, validates input with Zod, performs the mutation and `writeAuditLog()` in one Prisma transaction, then invalidates cache tags.
- **Route handlers** (no built-in origin check, so each does: session + permission + `Origin` check for mutating methods): uploads, media serving, private file download, CSV/XLSX export, QR generation, public form submit/upload, form start beacon.
- **Layering**
  - `src/lib/auth/*` — sessions, password hashing, `getSession`, `requirePermission`
  - `src/lib/rbac/*` — permission keys, role presets, effective-permission resolver (pure, tested)
  - `src/lib/forms/engine/*` — form definition schema + `evaluateForm()` (pure, shared client/server, heavily tested)
  - `src/lib/media/*` — storage (disk), sharp pipeline, variant specs
  - `src/lib/data/*` — cached read queries for public site
  - `src/server/actions/*` — Server Actions per domain
  - `src/components/public/*`, `src/components/admin/*`, `src/components/ui/*`

## 4. Auth, sessions, RBAC

**Sessions**: 32-byte random token in an httpOnly, `SameSite=Lax`, `Secure` (prod) cookie; DB stores SHA-256 of the token. 7-day lifetime, refreshed when older than 1 day. Logout and "sign out all sessions" delete rows. Deactivating an admin deletes their sessions.

**Passwords**: argon2id (`@node-rs/argon2`), min 12 chars. Login rate limit: 5 attempts / 15 min per IP+email, generic error message.

**Accounts**: invite-only. An admin with `admins.manage` creates an invite (email + role) and receives a one-time link `/admin/invite/[token]` (valid 72h; token hashed in DB) to share manually — no email provider needed. Super admin created by seed from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` env vars.

**Permission keys** (TS const union = source of truth, synced to `Permission` table by seed):

```
dashboard.view
events.create  events.edit  events.delete  events.publish
forms.create  forms.edit  forms.delete
forms.responses.view  forms.responses.export  forms.responses.delete
homepage.edit  homepage.publish
pages.manage            (page toggles, About/Contact content, navigation)
announcements.manage
team.manage
gallery.manage
sponsors.manage
media.upload
admins.manage  roles.manage
settings.manage
logs.view
```

**Effective permissions** = role permissions ∪ user GRANT overrides − user DENY overrides. The `super_admin` system role implicitly has every permission and cannot be deleted, edited or left without at least one active member. An admin cannot change their own role or overrides.

**Role presets** (seeded, editable): Super Admin, Event Manager (events.*, sponsors, forms.create/edit, responses.view/export, media.upload), Form Manager (forms.*), Content Manager (homepage.*, pages, announcements, gallery, media.upload), Team Manager (team, media.upload).

**Enforcement**: `requirePermission(key)` runs server-side in every action/handler and in every admin page's server component (redirect to `/admin/login` or render 403). The admin UI also hides controls the user lacks, but the server is the authority.

## 5. Data model (Prisma)

All ids `cuid()`; all models have `createdAt`/`updatedAt` unless noted.

**Auth & RBAC**
- `AdminUser` — email (unique, lowercased), name, passwordHash, avatarId?, roleId, isActive, lastLoginAt
- `Session` — id (= token hash), userId, expiresAt, ip, userAgent, lastSeenAt
- `Invite` — email, tokenHash, roleId, invitedById, expiresAt, acceptedAt?
- `Role` — key (unique), name, description, isSystem
- `Permission` — key (PK), group, description
- `RolePermission` — roleId + permissionKey (composite PK)
- `UserPermissionOverride` — userId + permissionKey (composite PK), effect `GRANT | DENY`
- `AuditLog` — actorId?, actorName (snapshot), action (e.g. `event.publish`), targetType, targetId?, targetLabel, metadata Json, ip, userAgent, createdAt. Indexed on createdAt, actorId, targetType

**Site**
- `SiteSettings` (singleton, id=1) — clubName, shortName, tagline, description, universityName, logoId?, email, phone, address, mapUrl, timezone, socials Json (instagram, linkedin, github, youtube, discord, whatsapp, x, custom[]), footer Json (blurb, columns of links, copyright), seo Json (titleTemplate, defaultDescription, ogImageId), navCtas Json
- `PageSetting` — key enum `HOME ABOUT EVENTS TEAM GALLERY ANNOUNCEMENTS SPONSORS CONTACT` (PK), enabled, showInNav, navLabel, navOrder, seoTitle?, seoDescription?, content Json (Zod schema per page: About = hero/mission/vision/what-we-do/timeline; Contact = intro, contact cards, embedded formId?). HOME cannot be disabled.
- `HomepageRevision` — status `DRAFT | PUBLISHED | SUPERSEDED`, sections Json, publishedAt?, publishedById?. Exactly one DRAFT row; latest PUBLISHED is live; publishing marks the old one SUPERSEDED, giving free history + "restore this version".

**Media**
- `Upload` — kind `IMAGE | FILE`, purpose `POSTER GALLERY TEAM LOGO SPONSOR COVER GENERIC FORM_FILE`, visibility `PUBLIC | PRIVATE`, originalName, mimeType, sizeBytes, width?, height?, storageKey (directory), variants Json (`[{name, width, height, format, file, bytes}]`), blurDataUrl?, alt, uploadedById?, formResponseId?

**Events**
- `EventCategory` — name, slug, order
- `Event` — slug (unique), title, tagline, description (sanitized HTML), posterId?, categoryId?, startAt, endAt, venue, mode `OFFLINE | ONLINE | HYBRID`, onlineUrl?, registrationDeadline?, maxParticipants?, eligibility, organizers Json (`[{name, role, contact}]`), contacts Json (`[{name, phone?, email?}]`), links Json (`[{label, url}]`), lifecycle `DRAFT | PUBLISHED | CANCELLED | ARCHIVED`, publishedAt?, registrationMode `NONE | FORM | EXTERNAL`, formId?, externalRegistrationUrl?, showCountdown, countdownTarget `START | DEADLINE`, featured, seoTitle?, seoDescription?, createdById, updatedById
- **Display status is derived, not stored**: Draft → Cancelled → Completed (now > endAt) → Ongoing (startAt ≤ now ≤ endAt) → Registration Open (mode ≠ NONE, before deadline, capacity left, form accepting) → Registration Closed → Upcoming. Pure function `deriveEventStatus(event, registrationStats, now)`, unit tested.
- `Sponsor` — name, logoId?, website?, description?, tier `TITLE POWERED_BY COMMUNITY_PARTNER TECHNOLOGY_PARTNER PARTNER` (+ customLabel?), showOnSponsorsPage, isActive, order
- `EventSponsor` — eventId + sponsorId, type (same enum) + customLabel?, order. Event cards show at most the title sponsor or one "Powered by" row; the detail page shows all.

**Forms**
- `Form` — slug (unique), name, description, coverId?, visibility `PUBLIC_LINK | EVENT_ONLY`, acceptingResponses, opensAt?, closesAt?, maxResponses?, oneResponsePerEmail, successMessage, submitLabel, reviewStep (bool), draftDefinition Json, publishedVersionId?, hasUnpublishedChanges, createdById
- `FormVersion` — formId, version (int), definition Json (immutable), createdById
- `FormResponse` — formId, versionId, eventId?, data Json (fieldId → value), email?, searchText (lowercased concatenation for ILIKE), pagePath Json, ipHash, userAgent, submittedAt
- `FormDailyStat` — formId + date (composite PK), views, starts, submissions

**Content**
- `Announcement` — slug, title, summary, content (sanitized HTML), status `DRAFT | PUBLISHED`, publishAt, expiresAt?, linkUrl?, linkLabel?, priority `NORMAL | IMPORTANT | URGENT`, pinned, showOnHomepage, showAsBanner, createdById. Visible iff PUBLISHED ∧ publishAt ≤ now ∧ (expiresAt null ∨ now < expiresAt). Banner shows highest-priority visible banner announcement; visitor can dismiss (localStorage, keyed by id + updatedAt).
- `TeamTerm` — label ("2026-27"), startYear (unique), isCurrent (exactly one), isPublished
- `Domain` — name, slug, description?, order (Development, Design, DevOps, AI/ML, Cybersecurity, Content, Marketing, Events)
- `TeamMember` — termId, name, photoId?, title (free text, e.g. "Chapter Lead"), tier `FACULTY LEAD CORE DOMAIN_LEAD MEMBER`, domainId?, bio?, links Json (linkedin, github, instagram, website, x), featured, order. "Copy members from previous term" action.
- `GalleryAlbum` — slug, title, description?, date?, coverId?, eventId?, isPublished, order
- `GalleryImage` — albumId, uploadId, caption?, order

**Analytics (lightweight, phase 6)**
- `DailyPageView` — date + path (composite PK), views. Incremented by a rate-limited, bot-filtered beacon; no cookies, no personal data.

## 6. Media pipeline

- Upload endpoint validates by **decoding with sharp** (images) or magic bytes via `file-type` (files) — never trusts MIME/extension. Caps: images 15 MB and 50 MP; form files 10 MB. SVG rejected. EXIF stripped (`rotate()` then no metadata). Filenames are generated UUIDs.
- Stored at `UPLOAD_DIR/<yyyy>/<mm>/<uuid>/<variant>.<ext>`; original kept as `original.<ext>`.
- Variant specs:
  - Poster: client crop locked to 16:9 (react-easy-crop), server authoritative crop + resize to 1600×900, widths 400/800/1200/1600 in AVIF + WebP, plus `og.jpg` 1200×675. Admin shows "Recommended 1600 × 900 (16:9). Minimum 960 × 540." Smaller sources are rejected; non-16:9 sources must be cropped.
  - Gallery: long edge capped at 2400, widths 480/960/1600/2400 AVIF + WebP.
  - Team photo: square crop, 200/400/800.
  - Logo / sponsor / cover: fit inside 800, WebP (alpha kept) + PNG fallback.
  - Every image gets a ~16px blur placeholder data URL and stored intrinsic dimensions.
- `<Picture>` component renders `<picture>` with AVIF/WebP `srcset`, `sizes`, width/height (no CLS), `loading="lazy"` except explicitly prioritized hero images. `next/image` optimizer is not used (variants already exist).
- Serving: `GET /media/[...path]` streams PUBLIC files with `Cache-Control: public, max-age=31536000, immutable` and `X-Content-Type-Options: nosniff`. PRIVATE files (form uploads) only via `/api/admin/files/[id]` with `forms.responses.view`, `Content-Disposition: attachment`. Path traversal blocked by resolving against `UPLOAD_DIR` and requiring a DB record.

## 7. Form engine

### 7.1 Definition schema (Zod, stored as JSON)

```ts
FormDefinition = { pages: Page[] }                        // 1..30 pages
Page = {
  id, title, description?,
  blocks: Block[],
  branches: { when: ConditionGroup, goTo: PageId | "submit" }[],   // first match wins
  defaultNext: "next" | PageId | "submit"
}
Block = Field | Content
Field = {
  id, kind: "field",
  type: "short_text" | "long_text" | "email" | "phone" | "number" | "dropdown"
      | "radio" | "checkboxes" | "date" | "time" | "url" | "file"
      | "linear_scale" | "rating" | "yes_no",
  label, help?, placeholder?, required, defaultValue?,
  options?: { id, label, visibleWhen?: ConditionGroup }[],     // choice types
  validation?: { minLength?, maxLength?, min?, max?, pattern?: "roll_number" | "custom",
                 customPattern?, minSelections?, maxSelections?,
                 fileTypes?: ("pdf"|"image"|"doc"|"zip")[], maxFileMb? , scaleMin?, scaleMax?,
                 scaleLabels? },
  visibleWhen?: ConditionGroup,
  width?: "full" | "half"
}
Content = { id, kind: "content", type: "heading" | "text" | "image" | "divider" | "callout",
            text?, html?, uploadId?, tone?: "info" | "warning", visibleWhen? }
ConditionGroup = { mode: "all" | "any", conditions: Condition[] }
Condition = { fieldId, op: "equals" | "not_equals" | "contains" | "not_contains"
                        | "any_of" | "none_of" | "is_empty" | "is_filled"
                        | "gt" | "lt" | "before" | "after", value? }
```

### 7.2 Definition validation (on save and on publish)
- Unique ids; conditions may only reference fields that appear **earlier** (earlier page, or earlier block on the same page).
- Branch targets must be **later** pages or `submit` → no loops, guaranteed termination.
- Operators must match field types; option-based values must reference existing option ids.
- Publish blocked while the draft is invalid; errors shown inline in the builder.

### 7.3 `evaluateForm(definition, answers)` (pure, shared client + server)
Returns `{ path: PageId[], visibleBlocks: Set, visibleOptions: Map<fieldId, Set<optionId>>, cleaned: answers }`:
1. Start at page 0. Compute visible blocks and options on the page from answers so far.
2. Drop answers for hidden fields and for selected options that are now hidden.
3. Pick next page from the first matching branch, else `defaultNext`.
4. Repeat until `submit`.

`validateSubmission(definition, answers)` runs `evaluateForm`, then validates only visible fields on the path (required, type, validation rules, options ∈ visible options). Server always re-runs it; client runs it per page for instant feedback.

### 7.4 Versioning
Builder edits `draftDefinition` (autosaved). **Publish** validates and snapshots a new `FormVersion`. Responses reference the version they were filled against. Exports union columns across versions by field id (latest label wins; removed fields appended at the end).

### 7.5 Public renderer (reference: `docs/reference/form-wizard-reference.png`)
Two-pane wizard card:
- **Left rail**: cover (event poster for event forms, form cover otherwise), title, meta with icons (event: date, time, venue, seats left; standalone: closes-at, responses left), vertical stepper of pages **on the current computed path** (+ Review), check circles for completed, filled number for current. Clicking a completed step jumps back.
- **Right pane**: `STEP n OF m` (mono) + leaf→mint progress bar, close (when opened over an event), page title + description, blocks (half-width fields pair up on desktop).
- **Review step** (if `reviewStep`): answers grouped per page, mono uppercase keys, EDIT per group, "Not provided" in muted italic.
- **Footer**: Back, "● DRAFT SAVED" indicator (answers autosaved to localStorage per form version; file uploads excluded), primary pill with `submitLabel`.
- **Success screen**: success message; for event forms an "Add to calendar" `.ics` download.
- Mobile: rail collapses to a compact header (title + step + progress).
- `/events/[slug]/register` renders the card over a blurred event backdrop; `/forms/[slug]` renders it full-page.

### 7.6 Submission rules (server, one transaction)
Rejects with a clear message when: form not accepting, before `opensAt` / after `closesAt`, linked event's registration deadline passed or event cancelled/completed, capacity reached (`min(form.maxResponses, event.maxParticipants)` counted after locking the form row with `SELECT … FOR UPDATE`), duplicate email when `oneResponsePerEmail`. Public submit and file upload routes are rate-limited per IP (submit 10/min, upload 20/min). A honeypot field and minimum fill-time check filter bots.

### 7.7 Responses admin
Table with pagination, search (`searchText ILIKE`), filters (date range, event, any choice field = value), detail drawer, delete (single/bulk, `forms.responses.delete`), export CSV (streamed) and XLSX (exceljs). **CSV/XLSX injection guard**: cells starting with `= + - @ \t \r` are prefixed with `'`. Analytics: total responses, responses per day (SVG area chart), views → starts → submissions funnel from `FormDailyStat`, per-choice-field breakdown bars. Every export writes an audit log entry.

## 8. Homepage CMS

`HomepageRevision.sections` = ordered array of `{ id, type, enabled, content }`, each `content` validated by a per-type Zod schema.

Section types: `hero`, `about`, `stats`, `event_spotlight`, `announcements`, `achievements`, `featured_team`, `gallery_highlights`, `sponsors`, `social`, `cta`. (Footer is global, edited in Settings.)

- `hero`: eyebrow, heading, highlighted word, subheading, up to 2 CTAs (label, href, style), background variant (`rings` | `grid` | `glow`), terminal lines, show logo tile, show socials.
- `stats`: items `{label, value, suffix, source: manual | events_completed | team_members | gallery_photos}`; auto sources computed live.
- `event_spotlight`: `mode: next_upcoming | pinned` (+ eventId), show countdown.
- `announcements`: max items, only `showOnHomepage`.
- `featured_team`: current term's `featured` members.
- `gallery_highlights`: album ids or latest N.
- `sponsors`: tier filter.
- `achievements`: items `{title, description, year, imageId?, link?}`.
- Every section: optional anchor id, heading/subheading overrides.

Editor: sortable section list (dnd-kit) with enable toggles, per-type form in a side panel, live preview iframe (`/admin/homepage/preview`, auth + `homepage.edit`) reloading on save. **Publish** (`homepage.publish`) copies draft to a new PUBLISHED revision. History lists past revisions with "Restore to draft". Audit logged.

## 9. Page toggles & navigation

One cached `getPageSettings()` feeds: navigation (enabled ∧ showInNav, ordered), `assertPageEnabled(key)` → `notFound()` at the top of each public page, `sitemap.ts`, and metadata. Disabling a page hides it from nav, 404s its routes (including children such as `/events/[slug]`), and drops it from the sitemap. Homepage sections pointing at a disabled page hide their "View all" links.

## 10. SEO & sharing

- `generateMetadata` on every public route; title template from settings.
- OpenGraph + Twitter card: event poster `og.jpg`; other pages use a generated `opengraph-image` (next/og) with logo tile + page title on pine background.
- JSON-LD: `Organization` (home), `Event` (event detail: name, dates, `eventAttendanceMode`, `eventStatus`, location/virtual location, image, organizer, registration URL), `BreadcrumbList` on detail pages.
- `sitemap.ts` + `robots.ts` (admin and forms disallowed from indexing; forms `noindex`).
- Semantic landmarks, one `h1` per page, canonical URLs from `SITE_URL`.

## 11. Security checklist

- Server-side RBAC on every action, admin page and admin route handler.
- Zod validation of every input; rich text sanitized with `sanitize-html` allowlist on write (links restricted to http/https/mailto, `rel="noopener noreferrer"` added).
- React escaping everywhere else; no `dangerouslySetInnerHTML` except sanitized rich text.
- Server Actions' built-in origin check; route handlers verify `Origin` for mutating requests; cookies `SameSite=Lax`, httpOnly, Secure in production.
- Rate limits: login, invite accept, public form submit/upload, beacons.
- Security headers: CSP (`default-src 'self'`, `img-src 'self' data: blob:`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`), HSTS (prod), `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`.
- Uploads per §6. Private files never under a public path.
- Audit log for every create/update/delete/publish/export/permission change/login/logout/failed login burst.
- Secrets only in env; seed never contains hardcoded credentials.

## 12. Accessibility & performance (acceptance criteria for every phase)

- Keyboard reachable, visible focus (mint ring), skip link, ARIA only where semantics fall short, labelled form controls, alt text required on image upload (admin form enforces it), contrast ≥ 4.5:1 for text.
- `prefers-reduced-motion` disables Lenis, parallax, tilt, counters (show final values), and entrance transforms.
- Images lazy with explicit dimensions; fonts via `next/font` with `display: swap`; admin-only libraries (Tiptap, dnd-kit, exceljs, react-easy-crop) never shipped to public routes; Motion components are client islands inside server-rendered pages.
- Target Lighthouse ≥ 90 on mobile for home, events, event detail.

## 13. Testing

- Vitest unit tests (TDD) for: form engine (`evaluateForm`, `validateDefinition`, `validateSubmission`), effective permissions, event status derivation, announcement visibility, CSV escaping, slug generation, variant spec math.
- Integration tests against a test database for: `requirePermission` in actions, registration capacity under concurrent submissions, session lifecycle.
- Playwright smoke tests: login, create + publish event, register through a multi-page branched form, export responses.
- Manual browser verification of each phase's UI.

## 14. Routes

Public: `/`, `/about`, `/events`, `/events/[slug]`, `/events/[slug]/register`, `/team`, `/team/[term]`, `/gallery`, `/gallery/[album]`, `/announcements`, `/announcements/[slug]`, `/sponsors`, `/contact`, `/forms/[slug]`, `/media/[...path]`, `/sitemap.xml`, `/robots.txt`.

Public API: `POST /api/forms/[slug]/submit`, `POST /api/forms/[slug]/upload`, `POST /api/forms/[slug]/beacon`, `POST /api/v` (page-view beacon).

Admin: `/admin/login`, `/admin/invite/[token]`, `/admin` (dashboard), `/admin/events`, `/admin/events/new`, `/admin/events/[id]`, `/admin/forms`, `/admin/forms/[id]/build`, `/admin/forms/[id]/responses`, `/admin/forms/[id]/settings`, `/admin/announcements`, `/admin/announcements/[id]`, `/admin/team`, `/admin/team/[termId]`, `/admin/gallery`, `/admin/gallery/[id]`, `/admin/sponsors`, `/admin/homepage`, `/admin/homepage/preview`, `/admin/pages`, `/admin/settings`, `/admin/users`, `/admin/roles`, `/admin/audit`, `/admin/account`.

Admin API: `POST /api/admin/uploads`, `GET /api/admin/files/[id]`, `GET /api/admin/forms/[id]/export?format=csv|xlsx`, `GET /api/admin/qr?target=…&format=png|svg&branded=0|1`.

## 15. QR codes

`qrcode` library, error correction H. Targets: event page, event registration URL (internal register route or external URL), standalone form. Plain (black on white) or branded (modules `#1F582E` on white, logo tile centred, composited with sharp for PNG; embedded image for SVG). Admin QR dialog: preview, download PNG/SVG, copy URL. Available from event and form screens.

## 16. Admin dashboard

Cards backed by real queries: upcoming events (next 5), active registrations (open events with count/capacity bars), recent responses (last 10 across forms the user can view), live announcements, draft events, recent admin activity (if `logs.view`), page views last 7 days (phase 6). Quick actions (each shown only with the permission): Create event, Create form, Post announcement, Add team member, Upload to gallery.

## 17. Build phases

Each phase ships features complete and verified. SEO metadata, a11y, reduced motion and lazy images are acceptance criteria within each phase, not deferred.

1. **Foundation** — project scaffold, verify `prisma dev` parity (migration + `FOR UPDATE` + `ILIKE`), full Prisma schema, seed (idempotent), auth (login/logout/invite/account), RBAC resolver + guards, audit log helper + viewer, admin users/roles/permission matrix UI, site settings, page toggles + navigation, media pipeline + `/media` route, design tokens + UI kit, public shell (nav, footer, announcement banner slot), admin shell + dashboard skeleton with real data.
2. **Events** — categories, CRUD, duplicate, lifecycle actions, poster crop/upload pipeline, sponsors (global + per event), public list (filters: upcoming/past/category) + detail (countdown, sponsors, organizers, links, share, JSON-LD, OG), QR dialog.
3. **Forms & registration** — engine (TDD), builder (pages, blocks, logic editor, branching, preview), publish/versioning, public wizard renderer, submit/upload routes, capacity/deadline rules, event registration wiring (form / external URL / none), responses table, filters, detail, delete, CSV/XLSX export, analytics, QR for forms.
4. **Homepage CMS & static pages** — all section types, editor with sortable sections + preview + publish + history, About and Contact page editors.
5. **Announcements, Team, Gallery** — announcements (priority, pin, homepage, banner, expiry), team terms + domains + members + archive + copy-from-previous, gallery albums + bulk upload + ordering + masonry + lightbox.
6. **Hardening & launch** — page-view analytics + dashboard card, security review pass, Lighthouse pass, Playwright smoke suite, production seed, deployment guide (systemd, nginx, Postgres, backups of DB + `UPLOAD_DIR`).
