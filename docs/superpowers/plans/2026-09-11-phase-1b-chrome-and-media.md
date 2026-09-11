# Phase 1b — Chrome & Media Implementation Plan

> Executed inline (superpowers:executing-plans). Lean format agreed on 2026-09-11: file map, exact interfaces, test cases; code is written once, in the files. Full test code in plans is reserved for the Phase 3 form engine.

**Goal:** Image pipeline, site settings, page toggles + navigation, public site shell, invites + users/roles/permission matrix, audit viewer, real dashboard.

**Spec:** `docs/superpowers/specs/2026-09-10-gfg-chapter-platform-design.md` §4, §6, §9, §11, §16, §17 (1b).

**Branch:** `feat/phase-1b` (stacked on `feat/phase-1a`; `main` untouched until the user picks a merge option).

## Global constraints (in addition to plan 1a's)

- Caching: no Cache Components. Public reads go through `unstable_cache` with tags from `src/lib/cache-tags.ts`; mutations call `invalidate(...tags)` (→ `revalidateTag(tag, { expire: 0 })`). Cached values are JSON-serialized: DTOs use ISO strings, never `Date`.
- Route handlers that mutate: session + permission + same-origin check (`src/lib/auth/api.ts`).
- Images are validated by decoding with sharp; SVG rejected; EXIF stripped; UUID storage keys; files live under `UPLOAD_DIR`, never `public/`.
- Every image a visitor can see requires alt text in the admin form.
- Navigation only lists pages that are enabled **and implemented** (`IMPLEMENTED_PAGES`, grows per phase).
- Every new admin action: permission guard + audit row + integration test for the guard.

## Tasks

### 1. Media core (TDD)
- `src/lib/media/variants.ts` — `ImageFormat`, `ImagePurpose` (`POSTER COVER GALLERY TEAM AVATAR LOGO SPONSOR GENERIC`), `PURPOSE_RULES`, `planVariants(purpose, w, h): VariantSpec[]`, `validateDimensions(purpose, w, h): string | null`, `pickFallback(variants): VariantFile`.
- `src/lib/media/storage.ts` — `uploadRoot()`, `newStorageKey(now?, id?)` → `yyyy/mm/uuid`, `resolveInside(root, ...parts): string | null`, `contentTypeFor(file)`, `mediaUrl(storageKey, file)`.
- `src/lib/media/process-image.ts` — `processImage(input: Buffer, purpose, crop?: CropRect): Promise<ProcessedImage>`; throws `UserError`.
- Tests: poster 1920×1080 → 4 widths × {avif, webp} + `og` 1200×675 jpeg; small sources never upscale; gallery portrait respects max edge; aspect mismatch and too-small messages; SVG rejected; garbage bytes rejected; crop honoured; EXIF stripped; blur placeholder is a data URL.

### 2. Upload storage, routes, `<Picture>`
- `src/server/media/save-image.ts` — `saveImage({ buffer, originalName, purpose, crop?, alt, uploadedById }): Promise<Upload>` (writes files, then DB row; removes files if the row fails).
- `src/lib/media/public-image.ts` — `PublicImage` DTO + `toPublicImage(upload)`.
- `src/lib/auth/api.ts` — `isSameOrigin(req)`, `ApiError`, `requireApiPermission(req, key)`, `apiHandler(fn)`.
- `POST /api/admin/uploads` (multipart: `file`, `purpose`, `alt`, `crop` JSON; `media.upload`; 15 MB cap; 60/min per admin).
- `GET /media/[...path]` — PUBLIC uploads only, immutable caching, `nosniff`.
- `src/components/media/picture.tsx` — `<Picture image sizes className priority />`.
- `src/components/admin/image-upload-field.tsx` — pick → crop dialog (aspect purposes) → upload → hidden input; shows requirement text; alt input.
- Tests: `resolveInside` traversal, `isSameOrigin`, integration test for `saveImage` (temp `UPLOAD_DIR`).

### 3. Settings + page settings data layer and admin screens
- `src/lib/cache-tags.ts` — `TAGS`, `invalidate(...tags)`.
- `src/lib/settings/schema.ts` — `hrefSchema`, `socialsSchema`, `footerSchema`, `seoSchema`, `navCtaSchema`, `siteSettingsFormSchema` (+ tests).
- `src/lib/data/site.ts` — `loadSiteSettings()`, `getSiteSettings()` (cached).
- `src/lib/data/pages.ts` — `PAGE_ROUTES`, `IMPLEMENTED_PAGES`, `loadPageSettings()`, `getPageSettings()`, `getNavigation()`, `assertPageEnabled(key)`.
- `/admin/settings` (`settings.manage`), `/admin/pages` (`pages.manage`) + actions with audit + invalidation. HOME cannot be disabled.

### 4. Public shell
- `src/app/(site)/layout.tsx` — header (logo tile, nav, CTA, mobile menu), footer (blurb, columns, socials, copyright), `generateMetadata` from settings.
- `src/app/(site)/page.tsx` — interim homepage built from settings (replaced by the CMS in Phase 4).
- `src/app/not-found.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`.

### 5. Invites, users, roles
- `src/lib/admin/policies.ts` (pure, TDD) — `canAssignRole`, `adminChangeProblem`, `roleDeleteProblem`.
- Actions: `createInviteAction`, `revokeInviteAction`, `updateAdminRoleAction`, `setAdminActiveAction`, `saveOverridesAction`, `acceptInviteAction`, `createRoleAction`, `updateRoleAction`, `deleteRoleAction`.
- Screens: `/admin/users`, `/admin/users/[id]`, `/admin/roles`, `/admin/roles/new`, `/admin/roles/[id]`, `/admin/invite/[token]`.
- Tests: guards, last-super-admin protection, self-edit protection, invite accept (expired / used / revoked / valid), role delete with members blocked.

### 6. Audit viewer + dashboard
- `src/lib/data/audit.ts` — `buildAuditWhere(filters)` (pure, tested), `listAuditLogs(filters, page)`.
- `/admin/audit` (`logs.view`) with filters + pagination.
- Dashboard: recent activity, admin/invite counts, quick actions for screens that exist.
- `ADMIN_NAV` gains Users, Roles, Pages, Settings, Audit log.

### 7. Verification
- Unit + integration + typecheck + lint + build; curl with DB-inserted sessions for every new admin screen; headless screenshots of public shell (desktop + 400px) and settings/pages screens; human browser checklist in the phase report.
