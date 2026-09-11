# Phase 1a — Data & Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Next.js app with the full database schema, idempotent seed, server-side RBAC, DB sessions, login/logout, an account page and the admin shell — sign in as super admin and manage your own account; nothing else exists yet.

**Architecture:** Next.js App Router monolith. Pure, unit-tested modules (`lib/rbac`, `lib/auth/password|tokens|session-policy`, `lib/security/rate-limit`, `lib/actions`, `lib/audit`) are wrapped by thin DB/Next adapters (`lib/auth/session`, `lib/auth/guard`, `server/actions/*`). Sessions and guards get integration tests against a second local `prisma dev` database.

**Tech Stack:** Next.js 16.3.4, React 19.3, TypeScript strict, Tailwind CSS 4.3, Prisma 7.10.0 + `@prisma/adapter-pg`, PostgreSQL (`prisma dev` locally), zod 4, `@node-rs/argon2`, Vitest, tsx, lucide-react, clsx + tailwind-merge.

**Spec:** `docs/superpowers/specs/2026-09-10-gfg-chapter-platform-design.md` (§1, §2, §4, §5, §11, §13, §17 phase 1a)

## Global Constraints

- Package manager: **npm**. Node 26.
- `prisma`, `@prisma/client`, `@prisma/adapter-pg` installed at **exactly `7.10.0`** (`npm i -E`). Never install them unpinned — the prisma CLI `latest` tag is an 8.0 RC.
- `prisma.config.ts` imports `dotenv/config` and uses `process.env.DATABASE_URL ?? ""` — never Prisma's `env()` helper.
- Generated Prisma client lives in `src/generated/prisma` (gitignored, produced by `postinstall` and `prisma generate`). Import from `@/generated/prisma/client`.
- Dev DB: `prisma dev` server `g4g` on ports 51213/51214/51215 → `DATABASE_URL=postgres://postgres:postgres@localhost:51214/template1?sslmode=disable`. Test DB: server `g4g-test` on 51223/51224/51225 → `TEST_DATABASE_URL=…:51224/…`.
- Session cookie name: `__Host-gfg_session` when `NODE_ENV=production`, otherwise `gfg_session`. httpOnly, `SameSite=Lax`, `Secure` in production, path `/`, max-age 30 days.
- Session validity: 7 days idle, 30 days absolute, touched at most once per day.
- Passwords: argon2id via `@node-rs/argon2` (memoryCost 19456, timeCost 2, parallelism 1), 12–256 characters.
- Every Server Action that mutates calls `requirePermission(key)` or `requireActionUser()` first; every admin page calls `requireUser()` or `requirePagePermission(key)`.
- Every mutation writes an audit entry via `writeAuditLog()`.
- Palette tokens (Tailwind `@theme`): night `#08120D`, pine `#0D1B14`, surface `#112219`, raised `#172C21`, line `#23392C`, frost `#E6EFE8`, muted `#93A89A`, brand `#2F8D46`, leaf `#5CC97B`, mint `#BDF3CB`, amber `#F2B84B`, danger `#F26D6D`, tile `#EEF4EF`.
- Fonts: Bricolage Grotesque (display), Geist (sans), Geist Mono (mono) via `next/font/google`.
- Logo: original artwork only, always on the light tile (`bg-tile`). Never recolour.
- Admin nav shows only features that exist — no links to unbuilt pages.
- Copy: active voice, say what happened ("Password changed"), errors say how to fix.
- Commit after every task with a conventional message and the session trailer:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012NAHJn9Tcyy8nwK7N989UF
  ```

## File map (created in this plan)

```
prisma.config.ts                     Prisma CLI config (dotenv, schema path, seed)
prisma/schema.prisma                 Full data model (spec §5)
prisma/seed.ts                       Entry point → src/server/seed/run.ts
vitest.config.ts                     Unit tests (excludes *.int.test.ts)
vitest.integration.config.ts         Integration tests against TEST_DATABASE_URL
next.config.ts                       standalone output, security headers, authInterrupts
.env.example / .env                  Environment variables
public/brand/logo.png|webp           Transparent original logo
src/app/icon.png, apple-icon.png     Logo on tile
src/app/globals.css                  Tailwind v4 theme tokens
src/app/layout.tsx                   Fonts, metadata base
src/app/page.tsx                     Temporary branded landing (replaced in 1b)
src/app/forbidden.tsx                403 view
src/app/admin/login/page.tsx         Sign-in page
src/app/admin/login/login-form.tsx   Client form
src/app/admin/(panel)/layout.tsx     Auth gate + AdminShell
src/app/admin/(panel)/page.tsx       Dashboard (welcome + access summary)
src/app/admin/(panel)/account/page.tsx + account-forms.tsx
src/components/brand/logo-tile.tsx
src/components/ui/{button,input,label,form-message}.tsx
src/components/admin/{admin-shell,sidebar,nav-items}.tsx
src/lib/utils/{cn,slug,time}.ts (+ tests)
src/lib/db.ts                        PrismaClient singleton
src/lib/rbac/{permissions,roles,resolve,sync}.ts (+ tests)
src/lib/auth/{password,tokens,session-policy,redirect}.ts (+ tests)
src/lib/auth/{session,guard}.ts (+ integration tests)
src/lib/security/{rate-limit,limiters}.ts (+ test)
src/lib/{actions,audit,request-meta,errors}.ts (+ tests)
src/server/seed/{defaults,run}.ts
src/server/actions/{auth,account}.ts
src/test/{empty-module,global-setup,int-setup,factories}.ts
```

---

### Task 1: Scaffold Next.js app and test tooling

**Files:**
- Create: whole scaffold from `create-next-app`, `vitest.config.ts`, `src/test/empty-module.ts`, `src/lib/utils/slug.ts`, `src/lib/utils/slug.test.ts`, `src/lib/utils/cn.ts`
- Modify: `.gitignore`, `package.json`

**Interfaces:**
- Produces: `slugify(input: string, maxLength?: number): string`, `uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string>`, `cn(...inputs: ClassValue[]): string`

- [ ] **Step 1: Scaffold into a temp dir and move into the repo** (the repo is non-empty, so create-next-app cannot target it directly)

```bash
TMP=/tmp/claude-1000/-home-realgamer7067-G4G-website/2a454b1b-a208-4f5f-8e30-56ea5392c754/scratchpad/scaffold
rm -rf "$TMP" && npx -y create-next-app@16.3.4 "$TMP" --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --yes
cd /home/realgamer7067/G4G_website
rsync -a --exclude .git --exclude .gitignore --exclude node_modules --exclude README.md "$TMP"/ ./
npm install
```
If a flag is rejected by this create-next-app version, drop that flag (the `--help` output is authoritative) and rerun.

- [ ] **Step 2: Merge `.gitignore`** — append create-next-app's entries not already present plus:

```
src/generated/
next-env.d.ts
```

- [ ] **Step 3: Install runtime and dev dependencies**

```bash
npm i -E prisma@7.10.0 -D
npm i -E @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0
npm i pg zod @node-rs/argon2 server-only clsx tailwind-merge lucide-react dotenv
npm i -D vitest tsx @types/pg
```

- [ ] **Step 4: Add scripts to `package.json`**

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:int": "vitest run --config vitest.integration.config.ts",
  "db:start": "prisma dev -n g4g -d -p 51213 -P 51214 --shadow-db-port 51215",
  "db:test:start": "prisma dev -n g4g-test -d -p 51223 -P 51224 --shadow-db-port 51225",
  "db:stop": "prisma dev stop g4g g4g-test",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:generate": "prisma generate",
  "db:seed": "tsx prisma/seed.ts",
  "db:studio": "prisma studio",
  "postinstall": "prisma generate"
}
```
(`postinstall` will fail until Task 2 adds the schema; run installs in this task before adding it, or ignore that single failure.)

- [ ] **Step 5: Create `vitest.config.ts` and `src/test/empty-module.ts`**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.int.test.ts", "node_modules/**"],
  },
});
```

```ts
// src/test/empty-module.ts
// Stands in for `server-only` under Vitest, which does not use the react-server export condition.
export {};
```

- [ ] **Step 6: Write the failing slug test**

```ts
// src/lib/utils/slug.test.ts
import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Hackathon 2026!")).toBe("hackathon-2026");
  });
  it("spells out ampersands", () => {
    expect(slugify("Git & GitHub Workshop")).toBe("git-and-github-workshop");
  });
  it("strips accents and surrounding whitespace", () => {
    expect(slugify("  Café Déjà vu  ")).toBe("cafe-deja-vu");
  });
  it("returns empty string for symbols only", () => {
    expect(slugify("!!!")).toBe("");
  });
  it("truncates without leaving a trailing hyphen", () => {
    expect(slugify("alpha beta gamma", 11)).toBe("alpha-beta");
  });
});

describe("uniqueSlug", () => {
  it("returns the base when free", async () => {
    expect(await uniqueSlug("orientation", async () => false)).toBe("orientation");
  });
  it("appends the first free numeric suffix", async () => {
    const taken = new Set(["devfest", "devfest-2"]);
    expect(await uniqueSlug("devfest", async (s) => taken.has(s))).toBe("devfest-3");
  });
  it("falls back to 'item' for an empty base", async () => {
    expect(await uniqueSlug("", async () => false)).toBe("item");
  });
});
```

- [ ] **Step 7: Run it and confirm it fails**

Run: `npx vitest run src/lib/utils/slug.test.ts`
Expected: FAIL — cannot resolve `./slug`.

- [ ] **Step 8: Implement `slug.ts` and `cn.ts`**

```ts
// src/lib/utils/slug.ts
export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const root = base || "item";
  if (!(await exists(root))) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
}
```

```ts
// src/lib/utils/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 9: Run tests, typecheck, lint**

Run: `npx vitest run src/lib/utils/slug.test.ts && npx tsc --noEmit && npm run lint`
Expected: 8 tests PASS; no type or lint errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with Vitest and slug utilities"
```

---

### Task 2: Prisma config, full schema, DB client, first migration

**Files:**
- Create: `prisma.config.ts`, `prisma/schema.prisma`, `src/lib/db.ts`, `.env.example`, `.env`
- Modify: `eslint.config.mjs` (ignore `src/generated/**`)

**Interfaces:**
- Produces: `db: PrismaClient` from `@/lib/db`; all Prisma model/enum types from `@/generated/prisma/client` (`AdminUser`, `Role`, `Session`, `OverrideEffect`, `PageKey`, `Prisma`, …).

- [ ] **Step 1: Start the dev and test databases**

```bash
npm run db:start && npm run db:test:start
DATABASE_URL=x npx prisma dev ls
```
Expected: `g4g` and `g4g-test` both `running`; TCP URLs on ports 51214 and 51224.

- [ ] **Step 2: Create `.env.example` and `.env`**

```bash
# .env.example
DATABASE_URL="postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
TEST_DATABASE_URL="postgres://postgres:postgres@localhost:51224/template1?sslmode=disable"
SITE_URL="http://localhost:3000"
UPLOAD_DIR="./data/uploads"
SUPERADMIN_EMAIL="admin@example.com"
SUPERADMIN_PASSWORD="change-me-to-a-long-passphrase"
# Set to 1 to reset the super admin password/role from the two values above on the next seed.
SEED_RESET_SUPERADMIN="0"
```
`.env` = same keys, with `SUPERADMIN_PASSWORD` set to the output of `openssl rand -base64 18`.

- [ ] **Step 3: Create `prisma.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma's env() helper throws on every CLI call when unset (even `prisma dev ls`).
    url: process.env.DATABASE_URL ?? "",
  },
});
```

- [ ] **Step 4: Write `prisma/schema.prisma`** (complete model from spec §5)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ─────────────────────────── Auth & RBAC ───────────────────────────

model AdminUser {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String
  avatarId     String?
  avatar       Upload?   @relation("AdminAvatar", fields: [avatarId], references: [id], onDelete: SetNull)
  roleId       String
  role         Role      @relation(fields: [roleId], references: [id])
  isActive     Boolean   @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  sessions            Session[]
  permissionOverrides UserPermissionOverride[]
  invitesSent         Invite[]           @relation("InviteSender")
  auditLogs           AuditLog[]
  uploads             Upload[]           @relation("UploadedBy")
  eventsCreated       Event[]            @relation("EventCreatedBy")
  eventsUpdated       Event[]            @relation("EventUpdatedBy")
  formsCreated        Form[]
  formVersions        FormVersion[]
  announcements       Announcement[]
  homepagePublishes   HomepageRevision[]
}

model Session {
  id         String    @id // SHA-256 of the cookie token
  userId     String
  user       AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt  DateTime
  createdAt  DateTime  @default(now())
  lastSeenAt DateTime  @default(now())
  ip         String?
  userAgent  String?

  @@index([userId])
}

model Invite {
  id          String     @id @default(cuid())
  email       String
  tokenHash   String     @unique
  roleId      String
  role        Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  invitedById String?
  invitedBy   AdminUser? @relation("InviteSender", fields: [invitedById], references: [id], onDelete: SetNull)
  expiresAt   DateTime
  acceptedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime   @default(now())

  @@index([email])
}

model Role {
  id          String   @id @default(cuid())
  key         String   @unique
  name        String
  description String   @default("")
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       AdminUser[]
  permissions RolePermission[]
  invites     Invite[]
}

model Permission {
  key         String @id
  group       String
  description String

  roles     RolePermission[]
  overrides UserPermissionOverride[]
}

model RolePermission {
  roleId        String
  role          Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permissionKey String
  permission    Permission @relation(fields: [permissionKey], references: [key], onDelete: Cascade)

  @@id([roleId, permissionKey])
}

enum OverrideEffect {
  GRANT
  DENY
}

model UserPermissionOverride {
  userId        String
  user          AdminUser      @relation(fields: [userId], references: [id], onDelete: Cascade)
  permissionKey String
  permission    Permission     @relation(fields: [permissionKey], references: [key], onDelete: Cascade)
  effect        OverrideEffect

  @@id([userId, permissionKey])
}

model AuditLog {
  id          String     @id @default(cuid())
  actorId     String?
  actor       AdminUser? @relation(fields: [actorId], references: [id], onDelete: SetNull)
  actorName   String
  action      String
  targetType  String
  targetId    String?
  targetLabel String     @default("")
  metadata    Json       @default("{}")
  ip          String?
  userAgent   String?
  createdAt   DateTime   @default(now())

  @@index([createdAt])
  @@index([actorId])
  @@index([targetType, targetId])
}

// ─────────────────────────── Site ───────────────────────────

model SiteSettings {
  id             Int      @id @default(1)
  clubName       String
  shortName      String
  tagline        String   @default("")
  description    String   @default("")
  universityName String   @default("")
  logoId         String?
  logo           Upload?  @relation("SiteLogo", fields: [logoId], references: [id], onDelete: SetNull)
  email          String   @default("")
  phone          String   @default("")
  address        String   @default("")
  mapUrl         String   @default("")
  timezone       String   @default("Asia/Kolkata")
  socials        Json     @default("{}")
  footer         Json     @default("{}")
  seo            Json     @default("{}")
  navCtas        Json     @default("[]")
  updatedAt      DateTime @updatedAt
}

enum PageKey {
  HOME
  ABOUT
  EVENTS
  TEAM
  GALLERY
  ANNOUNCEMENTS
  SPONSORS
  CONTACT
}

model PageSetting {
  key            PageKey  @id
  enabled        Boolean  @default(true)
  showInNav      Boolean  @default(true)
  navLabel       String
  navOrder       Int      @default(0)
  seoTitle       String?
  seoDescription String?
  content        Json     @default("{}")
  updatedAt      DateTime @updatedAt
}

enum RevisionStatus {
  DRAFT
  PUBLISHED
  SUPERSEDED
}

model HomepageRevision {
  id            String         @id @default(cuid())
  status        RevisionStatus
  sections      Json           @default("[]")
  publishedAt   DateTime?
  publishedById String?
  publishedBy   AdminUser?     @relation(fields: [publishedById], references: [id], onDelete: SetNull)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([status, publishedAt])
}

// ─────────────────────────── Media ───────────────────────────

enum UploadKind {
  IMAGE
  FILE
}

enum UploadPurpose {
  POSTER
  GALLERY
  TEAM
  LOGO
  SPONSOR
  COVER
  AVATAR
  GENERIC
  FORM_FILE
}

enum UploadVisibility {
  PUBLIC
  PRIVATE
}

model Upload {
  id             String           @id @default(cuid())
  kind           UploadKind
  purpose        UploadPurpose
  visibility     UploadVisibility @default(PUBLIC)
  originalName   String
  mimeType       String
  sizeBytes      Int
  width          Int?
  height         Int?
  storageKey     String           @unique
  variants       Json             @default("[]")
  blurDataUrl    String?
  alt            String           @default("")
  uploadedById   String?
  uploadedBy     AdminUser?       @relation("UploadedBy", fields: [uploadedById], references: [id], onDelete: SetNull)
  formResponseId String?
  formResponse   FormResponse?    @relation(fields: [formResponseId], references: [id], onDelete: SetNull)
  createdAt      DateTime         @default(now())

  adminAvatars  AdminUser[]    @relation("AdminAvatar")
  siteLogos     SiteSettings[] @relation("SiteLogo")
  eventPosters  Event[]
  sponsorLogos  Sponsor[]
  formCovers    Form[]
  teamPhotos    TeamMember[]
  albumCovers   GalleryAlbum[] @relation("AlbumCover")
  galleryImages GalleryImage[]

  @@index([purpose, createdAt])
}

// ─────────────────────────── Events ───────────────────────────

model EventCategory {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  events Event[]
}

enum EventMode {
  OFFLINE
  ONLINE
  HYBRID
}

enum EventLifecycle {
  DRAFT
  PUBLISHED
  CANCELLED
  ARCHIVED
}

enum RegistrationMode {
  NONE
  FORM
  EXTERNAL
}

enum CountdownTarget {
  START
  DEADLINE
}

model Event {
  id                      String           @id @default(cuid())
  slug                    String           @unique
  title                   String
  tagline                 String           @default("")
  description             String           @default("")
  posterId                String?
  poster                  Upload?          @relation(fields: [posterId], references: [id], onDelete: SetNull)
  categoryId              String?
  category                EventCategory?   @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  startAt                 DateTime
  endAt                   DateTime
  venue                   String           @default("")
  mode                    EventMode        @default(OFFLINE)
  onlineUrl               String?
  registrationDeadline    DateTime?
  maxParticipants         Int?
  eligibility             String           @default("")
  organizers              Json             @default("[]")
  contacts                Json             @default("[]")
  links                   Json             @default("[]")
  lifecycle               EventLifecycle   @default(DRAFT)
  publishedAt             DateTime?
  registrationMode        RegistrationMode @default(NONE)
  formId                  String?
  form                    Form?            @relation(fields: [formId], references: [id], onDelete: SetNull)
  externalRegistrationUrl String?
  showCountdown           Boolean          @default(false)
  countdownTarget         CountdownTarget  @default(START)
  featured                Boolean          @default(false)
  seoTitle                String?
  seoDescription          String?
  createdById             String?
  createdBy               AdminUser?       @relation("EventCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  updatedById             String?
  updatedBy               AdminUser?       @relation("EventUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)
  createdAt               DateTime         @default(now())
  updatedAt               DateTime         @updatedAt

  sponsors  EventSponsor[]
  responses FormResponse[]
  albums    GalleryAlbum[]

  @@index([lifecycle, startAt])
}

enum SponsorTier {
  TITLE
  POWERED_BY
  COMMUNITY_PARTNER
  TECHNOLOGY_PARTNER
  PARTNER
}

model Sponsor {
  id                 String      @id @default(cuid())
  name               String
  logoId             String?
  logo               Upload?     @relation(fields: [logoId], references: [id], onDelete: SetNull)
  website            String?
  description        String      @default("")
  tier               SponsorTier @default(PARTNER)
  customLabel        String?
  showOnSponsorsPage Boolean     @default(true)
  isActive           Boolean     @default(true)
  order              Int         @default(0)
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  events EventSponsor[]
}

model EventSponsor {
  eventId     String
  event       Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  sponsorId   String
  sponsor     Sponsor     @relation(fields: [sponsorId], references: [id], onDelete: Cascade)
  type        SponsorTier
  customLabel String?
  order       Int         @default(0)

  @@id([eventId, sponsorId])
}

// ─────────────────────────── Forms ───────────────────────────

enum FormVisibility {
  PUBLIC_LINK
  EVENT_ONLY
}

model Form {
  id                    String         @id @default(cuid())
  slug                  String         @unique
  name                  String
  description           String         @default("")
  coverId               String?
  cover                 Upload?        @relation(fields: [coverId], references: [id], onDelete: SetNull)
  visibility            FormVisibility @default(PUBLIC_LINK)
  acceptingResponses    Boolean        @default(true)
  opensAt               DateTime?
  closesAt              DateTime?
  maxResponses          Int?
  oneResponsePerEmail   Boolean        @default(false)
  successMessage        String         @default("Thanks! Your response has been recorded.")
  submitLabel           String         @default("Submit")
  reviewStep            Boolean        @default(true)
  draftDefinition       Json
  publishedVersionId    String?        @unique
  publishedVersion      FormVersion?   @relation("PublishedVersion", fields: [publishedVersionId], references: [id], onDelete: SetNull)
  hasUnpublishedChanges Boolean        @default(true)
  createdById           String?
  createdBy             AdminUser?     @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  versions   FormVersion[]   @relation("FormVersions")
  responses  FormResponse[]
  dailyStats FormDailyStat[]
  events     Event[]
}

model FormVersion {
  id          String     @id @default(cuid())
  formId      String
  form        Form       @relation("FormVersions", fields: [formId], references: [id], onDelete: Cascade)
  version     Int
  definition  Json
  createdById String?
  createdBy   AdminUser? @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt   DateTime   @default(now())

  publishedFor Form?          @relation("PublishedVersion")
  responses    FormResponse[]

  @@unique([formId, version])
}

model FormResponse {
  id          String      @id @default(cuid())
  formId      String
  form        Form        @relation(fields: [formId], references: [id], onDelete: Cascade)
  versionId   String
  version     FormVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)
  eventId     String?
  event       Event?      @relation(fields: [eventId], references: [id], onDelete: SetNull)
  data        Json
  email       String?
  searchText  String      @default("")
  pagePath    Json        @default("[]")
  ipHash      String?
  userAgent   String?
  submittedAt DateTime    @default(now())

  files Upload[]

  @@index([formId, submittedAt])
  @@index([formId, email])
}

model FormDailyStat {
  formId      String
  form        Form     @relation(fields: [formId], references: [id], onDelete: Cascade)
  date        DateTime @db.Date
  views       Int      @default(0)
  starts      Int      @default(0)
  submissions Int      @default(0)

  @@id([formId, date])
}

// ─────────────────────────── Content ───────────────────────────

enum PublishStatus {
  DRAFT
  PUBLISHED
}

enum AnnouncementPriority {
  NORMAL
  IMPORTANT
  URGENT
}

model Announcement {
  id             String               @id @default(cuid())
  slug           String               @unique
  title          String
  summary        String               @default("")
  content        String               @default("")
  status         PublishStatus        @default(DRAFT)
  publishAt      DateTime             @default(now())
  expiresAt      DateTime?
  linkUrl        String?
  linkLabel      String?
  priority       AnnouncementPriority @default(NORMAL)
  pinned         Boolean              @default(false)
  showOnHomepage Boolean              @default(false)
  showAsBanner   Boolean              @default(false)
  createdById    String?
  createdBy      AdminUser?           @relation(fields: [createdById], references: [id], onDelete: SetNull)
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([status, publishAt])
}

model TeamTerm {
  id          String   @id @default(cuid())
  label       String
  startYear   Int      @unique
  isCurrent   Boolean  @default(false)
  isPublished Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members TeamMember[]
}

model Domain {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String   @default("")
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  members TeamMember[]
}

enum TeamTier {
  FACULTY
  LEAD
  CORE
  DOMAIN_LEAD
  MEMBER
}

model TeamMember {
  id        String   @id @default(cuid())
  termId    String
  term      TeamTerm @relation(fields: [termId], references: [id], onDelete: Cascade)
  name      String
  photoId   String?
  photo     Upload?  @relation(fields: [photoId], references: [id], onDelete: SetNull)
  title     String
  tier      TeamTier @default(MEMBER)
  domainId  String?
  domain    Domain?  @relation(fields: [domainId], references: [id], onDelete: SetNull)
  bio       String   @default("")
  links     Json     @default("{}")
  featured  Boolean  @default(false)
  order     Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([termId, tier, order])
}

model GalleryAlbum {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  description String    @default("")
  date        DateTime?
  coverId     String?
  cover       Upload?   @relation("AlbumCover", fields: [coverId], references: [id], onDelete: SetNull)
  eventId     String?
  event       Event?    @relation(fields: [eventId], references: [id], onDelete: SetNull)
  isPublished Boolean   @default(false)
  order       Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  images GalleryImage[]
}

model GalleryImage {
  id        String       @id @default(cuid())
  albumId   String
  album     GalleryAlbum @relation(fields: [albumId], references: [id], onDelete: Cascade)
  uploadId  String
  upload    Upload       @relation(fields: [uploadId], references: [id], onDelete: Cascade)
  caption   String       @default("")
  order     Int          @default(0)
  createdAt DateTime     @default(now())

  @@index([albumId, order])
}

model DailyPageView {
  date  DateTime @db.Date
  path  String
  views Int      @default(0)

  @@id([date, path])
}
```

- [ ] **Step 5: Validate, migrate, generate**

```bash
npx prisma validate
npx prisma migrate dev --name init
npx prisma generate
```
Expected: "The schema is valid", migration `…_init` applied, client generated to `src/generated/prisma`.

- [ ] **Step 6: Create `src/lib/db.ts`**

```ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 7: Ignore generated code in ESLint** — add `"src/generated/**"` to the `ignores` array in `eslint.config.mjs` (create a `{ ignores: [...] }` entry if none exists).

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npm run lint && npx prisma migrate status` (prisma.config.ts loads `.env` itself)
Expected: no errors; "Database schema is up to date".

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(db): add Prisma 7 config, full schema and initial migration"
```

---

### Task 3: RBAC — permission keys, role presets, resolver

**Files:**
- Create: `src/lib/rbac/permissions.ts`, `src/lib/rbac/roles.ts`, `src/lib/rbac/resolve.ts`, `src/lib/rbac/rbac.test.ts`

**Interfaces:**
- Produces:
  - `PERMISSIONS` (readonly array of `{ key, group, description }`), `type PermissionKey`, `ALL_PERMISSION_KEYS: readonly PermissionKey[]`, `isPermissionKey(value: string): value is PermissionKey`, `PERMISSION_GROUPS: readonly string[]`
  - `SUPER_ADMIN_ROLE_KEY = "super_admin"`, `ROLE_PRESETS: readonly RolePreset[]` where `RolePreset = { key: string; name: string; description: string; isSystem: boolean; permissions: readonly PermissionKey[] | "*" }`
  - `type PermissionOverride = { permissionKey: string; effect: "GRANT" | "DENY" }`
  - `resolveEffectivePermissions(input: { roleKey: string; rolePermissionKeys: readonly string[]; overrides: readonly PermissionOverride[] }): ReadonlySet<PermissionKey>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/rbac/rbac.test.ts
import { describe, expect, it } from "vitest";
import { ALL_PERMISSION_KEYS, PERMISSIONS, isPermissionKey } from "./permissions";
import { ROLE_PRESETS, SUPER_ADMIN_ROLE_KEY } from "./roles";
import { resolveEffectivePermissions } from "./resolve";

describe("permission catalogue", () => {
  it("has unique, dotted, lowercase keys", () => {
    const keys = PERMISSIONS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z]+(\.[a-z]+)+$/);
  });
  it("includes every key named in the brief", () => {
    for (const k of [
      "events.create", "events.edit", "events.delete", "events.publish",
      "forms.create", "forms.responses.view", "forms.responses.export",
      "team.manage", "homepage.edit", "gallery.manage", "announcements.manage",
      "sponsors.manage", "admins.manage", "settings.manage", "logs.view",
    ]) expect(isPermissionKey(k)).toBe(true);
  });
  it("rejects unknown keys", () => {
    expect(isPermissionKey("events.hack")).toBe(false);
  });
});

describe("role presets", () => {
  it("defines exactly one system role: super admin with every permission", () => {
    const system = ROLE_PRESETS.filter((r) => r.isSystem);
    expect(system).toHaveLength(1);
    expect(system[0].key).toBe(SUPER_ADMIN_ROLE_KEY);
    expect(system[0].permissions).toBe("*");
  });
  it("only references known permissions and always grants dashboard access", () => {
    for (const preset of ROLE_PRESETS) {
      if (preset.permissions === "*") continue;
      for (const k of preset.permissions) expect(isPermissionKey(k)).toBe(true);
      expect(preset.permissions).toContain("dashboard.view");
    }
  });
});

describe("resolveEffectivePermissions", () => {
  it("gives super admin every permission and ignores deny overrides", () => {
    const perms = resolveEffectivePermissions({
      roleKey: SUPER_ADMIN_ROLE_KEY,
      rolePermissionKeys: [],
      overrides: [{ permissionKey: "logs.view", effect: "DENY" }],
    });
    expect(perms.size).toBe(ALL_PERMISSION_KEYS.length);
    expect(perms.has("logs.view")).toBe(true);
  });
  it("returns role permissions for a normal role", () => {
    const perms = resolveEffectivePermissions({
      roleKey: "team_manager",
      rolePermissionKeys: ["dashboard.view", "team.manage"],
      overrides: [],
    });
    expect([...perms].sort()).toEqual(["dashboard.view", "team.manage"]);
  });
  it("adds grants and removes denies, deny winning over grant", () => {
    const perms = resolveEffectivePermissions({
      roleKey: "event_manager",
      rolePermissionKeys: ["dashboard.view", "events.create", "events.delete"],
      overrides: [
        { permissionKey: "logs.view", effect: "GRANT" },
        { permissionKey: "events.delete", effect: "DENY" },
        { permissionKey: "team.manage", effect: "GRANT" },
        { permissionKey: "team.manage", effect: "DENY" },
      ],
    });
    expect(perms.has("logs.view")).toBe(true);
    expect(perms.has("events.delete")).toBe(false);
    expect(perms.has("team.manage")).toBe(false);
    expect(perms.has("events.create")).toBe(true);
  });
  it("drops unknown keys coming from the database", () => {
    const perms = resolveEffectivePermissions({
      roleKey: "custom",
      rolePermissionKeys: ["dashboard.view", "legacy.thing"],
      overrides: [{ permissionKey: "other.legacy", effect: "GRANT" }],
    });
    expect([...perms]).toEqual(["dashboard.view"]);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/rbac`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `permissions.ts`**

```ts
// src/lib/rbac/permissions.ts
export const PERMISSIONS = [
  { key: "dashboard.view", group: "General", description: "Open the admin dashboard" },
  { key: "events.create", group: "Events", description: "Create events and duplicate existing ones" },
  { key: "events.edit", group: "Events", description: "Edit event details, posters and event sponsors" },
  { key: "events.delete", group: "Events", description: "Permanently delete events" },
  { key: "events.publish", group: "Events", description: "Publish, unpublish, cancel and archive events" },
  { key: "forms.create", group: "Forms", description: "Create forms" },
  { key: "forms.edit", group: "Forms", description: "Edit and publish forms and change form settings" },
  { key: "forms.delete", group: "Forms", description: "Delete forms together with their responses" },
  { key: "forms.responses.view", group: "Forms", description: "View form responses and uploaded files" },
  { key: "forms.responses.export", group: "Forms", description: "Download responses as CSV or Excel" },
  { key: "forms.responses.delete", group: "Forms", description: "Delete form responses" },
  { key: "homepage.edit", group: "Website", description: "Edit homepage sections as a draft" },
  { key: "homepage.publish", group: "Website", description: "Publish the homepage draft to the live site" },
  { key: "pages.manage", group: "Website", description: "Turn pages on or off, edit About and Contact, change navigation" },
  { key: "announcements.manage", group: "Content", description: "Create, edit and remove announcements" },
  { key: "team.manage", group: "Content", description: "Manage team years and members" },
  { key: "gallery.manage", group: "Content", description: "Manage gallery albums and photos" },
  { key: "sponsors.manage", group: "Content", description: "Manage sponsors and partners" },
  { key: "media.upload", group: "Content", description: "Upload images and files" },
  { key: "admins.manage", group: "Administration", description: "Invite, deactivate and edit admins and their permissions" },
  { key: "roles.manage", group: "Administration", description: "Create and edit roles" },
  { key: "settings.manage", group: "Administration", description: "Edit club details, social links, footer and SEO defaults" },
  { key: "logs.view", group: "Administration", description: "View the audit log" },
] as const satisfies readonly { key: string; group: string; description: string }[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

const KEY_SET: ReadonlySet<string> = new Set(ALL_PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return KEY_SET.has(value);
}

export const PERMISSION_GROUPS: readonly string[] = [...new Set(PERMISSIONS.map((p) => p.group))];
```

- [ ] **Step 4: Implement `roles.ts`**

```ts
// src/lib/rbac/roles.ts
import type { PermissionKey } from "./permissions";

export const SUPER_ADMIN_ROLE_KEY = "super_admin";

export type RolePreset = {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: readonly PermissionKey[] | "*";
};

export const ROLE_PRESETS: readonly RolePreset[] = [
  {
    key: SUPER_ADMIN_ROLE_KEY,
    name: "Super Admin",
    description: "Full access, including admins, roles and settings. Cannot be restricted.",
    isSystem: true,
    permissions: "*",
  },
  {
    key: "event_manager",
    name: "Event Manager",
    description: "Runs events end to end: details, posters, sponsors, registration forms and responses.",
    isSystem: false,
    permissions: [
      "dashboard.view", "events.create", "events.edit", "events.delete", "events.publish",
      "sponsors.manage", "forms.create", "forms.edit", "forms.responses.view",
      "forms.responses.export", "media.upload",
    ],
  },
  {
    key: "form_manager",
    name: "Form Manager",
    description: "Builds forms and manages their responses.",
    isSystem: false,
    permissions: [
      "dashboard.view", "forms.create", "forms.edit", "forms.delete", "forms.responses.view",
      "forms.responses.export", "forms.responses.delete", "media.upload",
    ],
  },
  {
    key: "content_manager",
    name: "Content Manager",
    description: "Keeps the website fresh: homepage, pages, announcements and gallery.",
    isSystem: false,
    permissions: [
      "dashboard.view", "homepage.edit", "homepage.publish", "pages.manage",
      "announcements.manage", "gallery.manage", "media.upload",
    ],
  },
  {
    key: "team_manager",
    name: "Team Manager",
    description: "Maintains team years and member profiles.",
    isSystem: false,
    permissions: ["dashboard.view", "team.manage", "media.upload"],
  },
];
```

- [ ] **Step 5: Implement `resolve.ts`**

```ts
// src/lib/rbac/resolve.ts
import { ALL_PERMISSION_KEYS, isPermissionKey, type PermissionKey } from "./permissions";
import { SUPER_ADMIN_ROLE_KEY } from "./roles";

export type PermissionOverride = { permissionKey: string; effect: "GRANT" | "DENY" };

export function resolveEffectivePermissions(input: {
  roleKey: string;
  rolePermissionKeys: readonly string[];
  overrides: readonly PermissionOverride[];
}): ReadonlySet<PermissionKey> {
  if (input.roleKey === SUPER_ADMIN_ROLE_KEY) return new Set(ALL_PERMISSION_KEYS);

  const result = new Set<PermissionKey>();
  for (const key of input.rolePermissionKeys) if (isPermissionKey(key)) result.add(key);
  for (const o of input.overrides) {
    if (o.effect === "GRANT" && isPermissionKey(o.permissionKey)) result.add(o.permissionKey);
  }
  for (const o of input.overrides) {
    if (o.effect === "DENY" && isPermissionKey(o.permissionKey)) result.delete(o.permissionKey);
  }
  return result;
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/rbac`
Expected: 9 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rbac
git commit -m "feat(rbac): add permission catalogue, role presets and effective-permission resolver"
```

---

### Task 4: Password hashing and session tokens

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/tokens.ts`, `src/lib/auth/crypto.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(hash: string, plain: string): Promise<boolean>`, `passwordProblem(plain: string): string | null`, `generateToken(bytes?: number): string`, `hashToken(token: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/auth/crypto.test.ts
import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { generateToken, hashToken } from "./tokens";

describe("password hashing", () => {
  it("produces an argon2id hash that verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
  });
  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword(hash, "wrong horse battery")).toBe(false);
  });
  it("returns false instead of throwing on a malformed hash", async () => {
    expect(await verifyPassword("not-a-hash", "anything")).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("requires at least 12 characters", () => {
    expect(passwordProblem("short")).toBe("Use at least 12 characters.");
  });
  it("caps length at 256", () => {
    expect(passwordProblem("a".repeat(257))).toBe("Use at most 256 characters.");
  });
  it("accepts a reasonable passphrase", () => {
    expect(passwordProblem("green pine night 42")).toBeNull();
  });
});

describe("tokens", () => {
  it("generates url-safe random tokens of 32 bytes", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("hashes deterministically to 64 hex chars", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/auth/crypto.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/auth/password.ts
import { hash, verify } from "@node-rs/argon2";

// OWASP-recommended argon2id parameters. @node-rs/argon2 defaults to argon2id.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 };

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

export function passwordProblem(plain: string): string | null {
  if (plain.length < 12) return "Use at least 12 characters.";
  if (plain.length > 256) return "Use at most 256 characters.";
  return null;
}
```

```ts
// src/lib/auth/tokens.ts
import { createHash, randomBytes } from "node:crypto";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/auth/crypto.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth
git commit -m "feat(auth): add argon2id password hashing and session token helpers"
```

---

### Task 5: In-memory rate limiter

**Files:**
- Create: `src/lib/security/rate-limit.ts`, `src/lib/security/rate-limit.test.ts`, `src/lib/security/limiters.ts`

**Interfaces:**
- Produces: `type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number }`, `createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }): { check(key: string, now?: number): RateLimitResult; reset(key: string): void }`, singletons `loginLimiter`, `loginIpLimiter` from `limiters.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/security/rate-limit.test.ts
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit within the window", () => {
    const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect(rl.check("k", 0)).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
    expect(rl.check("k", 10).remaining).toBe(1);
    expect(rl.check("k", 20).remaining).toBe(0);
    const blocked = rl.check("k", 30);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(970);
  });
  it("frees slots as old hits slide out of the window", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 1000 });
    rl.check("k", 0);
    rl.check("k", 500);
    expect(rl.check("k", 999).allowed).toBe(false);
    expect(rl.check("k", 1000).allowed).toBe(true);
  });
  it("keeps keys independent", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(rl.check("a", 0).allowed).toBe(true);
    expect(rl.check("b", 0).allowed).toBe(true);
    expect(rl.check("a", 1).allowed).toBe(false);
  });
  it("reset clears a key", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
    rl.check("a", 0);
    rl.reset("a");
    expect(rl.check("a", 1).allowed).toBe(true);
  });
  it("evicts the least recently used key beyond maxKeys", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 10_000, maxKeys: 2 });
    rl.check("a", 0);
    rl.check("b", 1);
    rl.check("c", 2); // evicts "a"
    expect(rl.check("a", 3).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/security`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/security/rate-limit.ts
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

/** Sliding-window log limiter. Process-local: correct for the single-process VPS deployment. */
export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }) {
  const { limit, windowMs, maxKeys = 10_000 } = opts;
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      const log = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      hits.delete(key); // re-insert below so Map order tracks recency
      if (log.length >= limit) {
        hits.set(key, log);
        return { allowed: false, remaining: 0, retryAfterMs: log[0] + windowMs - now };
      }
      log.push(now);
      hits.set(key, log);
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return { allowed: true, remaining: limit - log.length, retryAfterMs: 0 };
    },
    reset(key: string): void {
      hits.delete(key);
    },
  };
}
```

```ts
// src/lib/security/limiters.ts
import "server-only";
import { createRateLimiter } from "./rate-limit";

const FIFTEEN_MINUTES = 15 * 60_000;

/** Per IP + email: 5 attempts per 15 minutes. */
export const loginLimiter = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });
/** Per IP across all emails: 30 attempts per 15 minutes. */
export const loginIpLimiter = createRateLimiter({ limit: 30, windowMs: FIFTEEN_MINUTES });
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/security`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/security
git commit -m "feat(security): add sliding-window in-memory rate limiter"
```

---

### Task 6: Action results, errors, request metadata, audit log, small utilities

**Files:**
- Create: `src/lib/errors.ts`, `src/lib/actions.ts`, `src/lib/actions.test.ts`, `src/lib/request-meta.ts`, `src/lib/request-meta.test.ts`, `src/lib/audit.ts`, `src/lib/audit.test.ts`, `src/lib/auth/redirect.ts`, `src/lib/auth/redirect.test.ts`, `src/lib/utils/time.ts`, `src/lib/utils/time.test.ts`

**Interfaces:**
- Produces:
  - `class UserError extends Error { fieldErrors?: FieldErrors }`, `class ForbiddenError extends Error`, `class UnauthorizedError extends Error`
  - `type FieldErrors = Record<string, string[] | undefined>`, `type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: FieldErrors }`, `runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>>`
  - `type RequestMeta = { ip: string | null; userAgent: string | null }`, `parseRequestMeta(h: Headers): RequestMeta`, `getRequestMeta(): Promise<RequestMeta>`
  - `type AuditEntry = { actor: { id: string; name: string } | null; action: string; target: { type: string; id?: string | null; label?: string }; metadata?: Record<string, unknown>; meta?: RequestMeta }`, `writeAuditLog(client: AuditClient, entry: AuditEntry): Promise<void>` where `AuditClient = Pick<Prisma.TransactionClient, "auditLog">`
  - `safeAdminRedirect(value: unknown): string`
  - `timeAgo(date: Date, now?: Date): string`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/actions.test.ts
import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction } from "./actions";
import { ForbiddenError, UnauthorizedError, UserError } from "./errors";

describe("runAction", () => {
  it("wraps a successful result", async () => {
    expect(await runAction(async () => 42)).toEqual({ ok: true, data: 42 });
  });
  it("passes user errors through with field errors", async () => {
    const result = await runAction(async () => {
      throw new UserError("That slug is taken.", { slug: ["That slug is taken."] });
    });
    expect(result).toEqual({ ok: false, error: "That slug is taken.", fieldErrors: { slug: ["That slug is taken."] } });
  });
  it("maps zod errors to field errors", async () => {
    const result = await runAction(async () => z.object({ name: z.string().min(2) }).parse({ name: "a" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Check the highlighted fields.");
      expect(result.fieldErrors?.name?.length).toBe(1);
    }
  });
  it("maps permission errors", async () => {
    const result = await runAction(async () => { throw new ForbiddenError(); });
    expect(result).toEqual({ ok: false, error: "You don't have permission to do that." });
  });
  it("maps missing sessions", async () => {
    const result = await runAction(async () => { throw new UnauthorizedError(); });
    expect(result).toEqual({ ok: false, error: "Your session has ended. Sign in again." });
  });
  it("hides unexpected errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAction(async () => { throw new Error("db exploded"); });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Try again." });
    spy.mockRestore();
  });
  it("rethrows Next.js redirects", async () => {
    await expect(runAction(async () => redirect("/admin"))).rejects.toThrow();
  });
});
```

```ts
// src/lib/request-meta.test.ts
import { describe, expect, it } from "vitest";
import { parseRequestMeta } from "./request-meta";

describe("parseRequestMeta", () => {
  it("prefers x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "10.0.0.2", "x-forwarded-for": "1.1.1.1, 10.0.0.1", "user-agent": "UA" });
    expect(parseRequestMeta(h)).toEqual({ ip: "10.0.0.2", userAgent: "UA" });
  });
  it("falls back to the first x-forwarded-for entry", () => {
    expect(parseRequestMeta(new Headers({ "x-forwarded-for": " 1.1.1.1 , 10.0.0.1" })).ip).toBe("1.1.1.1");
  });
  it("returns nulls when headers are absent", () => {
    expect(parseRequestMeta(new Headers())).toEqual({ ip: null, userAgent: null });
  });
  it("truncates long user agents to 512 characters", () => {
    expect(parseRequestMeta(new Headers({ "user-agent": "x".repeat(900) })).userAgent).toHaveLength(512);
  });
});
```

```ts
// src/lib/audit.test.ts
import { describe, expect, it } from "vitest";
import { writeAuditLog, type AuditClient } from "./audit";

function fakeClient() {
  const calls: unknown[] = [];
  const client = { auditLog: { create: async (args: unknown) => { calls.push(args); return {}; } } } as unknown as AuditClient;
  return { client, calls };
}

describe("writeAuditLog", () => {
  it("records actor, target, metadata and request info", async () => {
    const { client, calls } = fakeClient();
    await writeAuditLog(client, {
      actor: { id: "u1", name: "Alex" },
      action: "event.publish",
      target: { type: "Event", id: "e1", label: "Code Sprint" },
      metadata: { from: "DRAFT" },
      meta: { ip: "1.2.3.4", userAgent: "UA" },
    });
    expect(calls).toEqual([{ data: {
      actorId: "u1", actorName: "Alex", action: "event.publish", targetType: "Event", targetId: "e1",
      targetLabel: "Code Sprint", metadata: { from: "DRAFT" }, ip: "1.2.3.4", userAgent: "UA",
    } }]);
  });
  it("labels system actions and fills defaults", async () => {
    const { client, calls } = fakeClient();
    await writeAuditLog(client, { actor: null, action: "auth.login_failed", target: { type: "AdminUser" } });
    expect(calls).toEqual([{ data: {
      actorId: null, actorName: "System", action: "auth.login_failed", targetType: "AdminUser", targetId: null,
      targetLabel: "", metadata: {}, ip: null, userAgent: null,
    } }]);
  });
});
```

```ts
// src/lib/auth/redirect.test.ts
import { describe, expect, it } from "vitest";
import { safeAdminRedirect } from "./redirect";

describe("safeAdminRedirect", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/account", "/admin/account"],
    ["/admin?tab=1", "/admin?tab=1"],
  ])("keeps %s", (input, expected) => expect(safeAdminRedirect(input)).toBe(expected));
  it.each([
    ["https://evil.test/admin"], ["//evil.test"], ["/adminx"], ["/admin/login"], ["/\\evil"], [null], [""], ["/events"],
  ])("replaces %s with /admin", (input) => expect(safeAdminRedirect(input)).toBe("/admin"));
});
```

```ts
// src/lib/utils/time.test.ts
import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

const now = new Date("2026-09-10T12:00:00Z");
describe("timeAgo", () => {
  it("says just now under 45 seconds", () => {
    expect(timeAgo(new Date("2026-09-10T11:59:30Z"), now)).toBe("just now");
  });
  it("uses minutes, hours and days", () => {
    expect(timeAgo(new Date("2026-09-10T11:55:00Z"), now)).toBe("5 minutes ago");
    expect(timeAgo(new Date("2026-09-10T10:00:00Z"), now)).toBe("2 hours ago");
    expect(timeAgo(new Date("2026-09-09T12:00:00Z"), now)).toBe("yesterday");
  });
  it("handles future dates", () => {
    expect(timeAgo(new Date("2026-09-10T15:00:00Z"), now)).toBe("in 3 hours");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/actions.test.ts src/lib/request-meta.test.ts src/lib/audit.test.ts src/lib/auth/redirect.test.ts src/lib/utils/time.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/errors.ts
export type FieldErrors = Record<string, string[] | undefined>;

/** An error whose message is safe and useful to show the user. */
export class UserError extends Error {
  constructor(message: string, public fieldErrors?: FieldErrors) {
    super(message);
    this.name = "UserError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Your session has ended. Sign in again.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
```

```ts
// src/lib/actions.ts
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { ForbiddenError, UnauthorizedError, UserError, type FieldErrors } from "./errors";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error); // let redirect()/notFound()/forbidden() propagate
    if (error instanceof UserError) {
      return error.fieldErrors
        ? { ok: false, error: error.message, fieldErrors: error.fieldErrors }
        : { ok: false, error: error.message };
    }
    if (error instanceof z.ZodError) {
      return { ok: false, error: "Check the highlighted fields.", fieldErrors: z.flattenError(error).fieldErrors as FieldErrors };
    }
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return { ok: false, error: error.message };
    }
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
```

```ts
// src/lib/request-meta.ts
import { headers } from "next/headers";

export type RequestMeta = { ip: string | null; userAgent: string | null };

/** nginx sets X-Real-IP in production; X-Forwarded-For is the fallback. */
export function parseRequestMeta(h: Headers): RequestMeta {
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 512) ?? null;
  return { ip, userAgent };
}

export async function getRequestMeta(): Promise<RequestMeta> {
  return parseRequestMeta(await headers());
}
```

```ts
// src/lib/audit.ts
import type { Prisma } from "@/generated/prisma/client";
import type { RequestMeta } from "./request-meta";

export type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export type AuditEntry = {
  actor: { id: string; name: string } | null;
  action: string;
  target: { type: string; id?: string | null; label?: string };
  metadata?: Record<string, unknown>;
  meta?: RequestMeta;
};

/** Call with the transaction client (`tx`) when inside a transaction so the log commits with the change. */
export async function writeAuditLog(client: AuditClient, entry: AuditEntry): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actor?.id ?? null,
      actorName: entry.actor?.name ?? "System",
      action: entry.action,
      targetType: entry.target.type,
      targetId: entry.target.id ?? null,
      targetLabel: entry.target.label ?? "",
      metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
      ip: entry.meta?.ip ?? null,
      userAgent: entry.meta?.userAgent ?? null,
    },
  });
}
```

```ts
// src/lib/auth/redirect.ts
/** Only allow redirects back into the admin area, never to login or another origin. */
export function safeAdminRedirect(value: unknown): string {
  if (typeof value !== "string" || value.includes("\\")) return "/admin";
  const inAdmin = value === "/admin" || value.startsWith("/admin/") || value.startsWith("/admin?");
  if (!inAdmin || value.startsWith("/admin/login")) return "/admin";
  return value;
}
```

```ts
// src/lib/utils/time.ts
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.sign(seconds), "minute");
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: all unit tests PASS (slug, rbac, crypto, rate-limit, actions, request-meta, audit, redirect, time).

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "feat(core): add action results, typed errors, request metadata, audit log writer"
```

---

### Task 7: Idempotent seed

**Files:**
- Create: `src/lib/rbac/sync.ts`, `src/server/seed/defaults.ts`, `src/server/seed/run.ts`, `prisma/seed.ts`

**Interfaces:**
- Consumes: `PERMISSIONS`, `ROLE_PRESETS`, `SUPER_ADMIN_ROLE_KEY`, `hashPassword`, `passwordProblem`
- Produces: `syncPermissions(db: PrismaClient): Promise<void>`, `ensureRolePresets(db: PrismaClient): Promise<void>`, `runSeed(db: PrismaClient, env: NodeJS.ProcessEnv): Promise<void>`, `PAGE_DEFAULTS`, `DOMAIN_DEFAULTS`, `CATEGORY_DEFAULTS`, `SITE_DEFAULTS`

- [ ] **Step 1: Implement `sync.ts`** (used by the seed and by integration-test factories)

```ts
// src/lib/rbac/sync.ts
import type { PrismaClient } from "@/generated/prisma/client";
import { ALL_PERMISSION_KEYS, PERMISSIONS } from "./permissions";
import { ROLE_PRESETS } from "./roles";

/** Make the Permission table match the code catalogue exactly. */
export async function syncPermissions(db: PrismaClient): Promise<void> {
  for (const p of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, group: p.group, description: p.description },
      update: { group: p.group, description: p.description },
    });
  }
  await db.permission.deleteMany({ where: { key: { notIn: [...ALL_PERMISSION_KEYS] } } });
}

/** Create missing preset roles. Existing non-system roles are left alone so admin edits survive re-seeding. */
export async function ensureRolePresets(db: PrismaClient): Promise<void> {
  for (const preset of ROLE_PRESETS) {
    const existing = await db.role.findUnique({ where: { key: preset.key } });
    if (existing) {
      if (preset.isSystem) {
        await db.role.update({
          where: { id: existing.id },
          data: { name: preset.name, description: preset.description, isSystem: true },
        });
      }
      continue;
    }
    await db.role.create({
      data: {
        key: preset.key,
        name: preset.name,
        description: preset.description,
        isSystem: preset.isSystem,
        permissions: {
          create: preset.permissions === "*" ? [] : preset.permissions.map((permissionKey) => ({ permissionKey })),
        },
      },
    });
  }
}
```

- [ ] **Step 2: Implement `defaults.ts`**

```ts
// src/server/seed/defaults.ts
import type { PageKey } from "@/generated/prisma/client";

export const SITE_DEFAULTS = {
  clubName: "GeeksforGeeks Student Chapter",
  shortName: "GFG Student Chapter",
  tagline: "Learn it. Build it. Ship it together.",
  description:
    "A student-run community for people who like to build: workshops, hackathons, open-source sprints and a crew that actually pushes code.",
  universityName: "Your University",
  email: "gfg.chapter@example.edu",
  timezone: "Asia/Kolkata",
  socials: { instagram: "", linkedin: "", github: "", youtube: "", discord: "", whatsapp: "", x: "", custom: [] },
  footer: { blurb: "Built by students, for students.", columns: [], copyright: "GeeksforGeeks Student Chapter" },
  seo: { titleTemplate: "%s · GFG Student Chapter", defaultDescription: "Workshops, hackathons and a community of student builders." },
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
```

- [ ] **Step 3: Implement `run.ts` and `prisma/seed.ts`**

```ts
// src/server/seed/run.ts
import type { PrismaClient } from "@/generated/prisma/client";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { ensureRolePresets, syncPermissions } from "@/lib/rbac/sync";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/rbac/roles";
import { slugify } from "@/lib/utils/slug";
import { CATEGORY_DEFAULTS, DOMAIN_DEFAULTS, PAGE_DEFAULTS, SITE_DEFAULTS } from "./defaults";

export async function runSeed(db: PrismaClient, env: NodeJS.ProcessEnv): Promise<void> {
  await syncPermissions(db);
  await ensureRolePresets(db);
  await seedSuperAdmin(db, env);

  await db.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...SITE_DEFAULTS }, update: {} });

  for (const page of PAGE_DEFAULTS) {
    await db.pageSetting.upsert({ where: { key: page.key }, create: page, update: {} });
  }
  for (const [order, name] of DOMAIN_DEFAULTS.entries()) {
    const slug = slugify(name.replace("/", " "));
    await db.domain.upsert({ where: { slug }, create: { name, slug, order }, update: {} });
  }
  for (const [order, name] of CATEGORY_DEFAULTS.entries()) {
    const slug = slugify(name);
    await db.eventCategory.upsert({ where: { slug }, create: { name, slug, order }, update: {} });
  }
}

async function seedSuperAdmin(db: PrismaClient, env: NodeJS.ProcessEnv): Promise<void> {
  const email = env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn("SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping super admin.");
    return;
  }
  const problem = passwordProblem(password);
  if (problem) throw new Error(`SUPERADMIN_PASSWORD: ${problem}`);

  const role = await db.role.findUniqueOrThrow({ where: { key: SUPER_ADMIN_ROLE_KEY } });
  const existing = await db.adminUser.findUnique({ where: { email } });
  if (!existing) {
    await db.adminUser.create({
      data: { email, name: "Super Admin", passwordHash: await hashPassword(password), roleId: role.id },
    });
    console.log(`Created super admin ${email}`);
  } else if (env.SEED_RESET_SUPERADMIN === "1") {
    await db.adminUser.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password), roleId: role.id, isActive: true },
    });
    await db.session.deleteMany({ where: { userId: existing.id } });
    console.log(`Reset super admin ${email}`);
  }
}
```

```ts
// prisma/seed.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { runSeed } from "../src/server/seed/run";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });

runSeed(db, process.env)
  .then(() => console.log("Seed complete"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
```

- [ ] **Step 4: Run the seed twice and check it is idempotent**

```bash
npm run db:seed && npm run db:seed
PGPASSWORD=postgres psql -h localhost -p 51214 -U postgres -d template1 -c 'SELECT (SELECT count(*) FROM "Permission") p, (SELECT count(*) FROM "Role") r, (SELECT count(*) FROM "AdminUser") u, (SELECT count(*) FROM "PageSetting") pg, (SELECT count(*) FROM "Domain") d, (SELECT count(*) FROM "EventCategory") c;'
```
Expected: first run prints "Created super admin …", second does not; counts `p=23 r=5 u=1 pg=8 d=8 c=6`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add idempotent seed for permissions, roles, super admin and site defaults"
```

---

### Task 8: Sessions and permission guards (with integration tests)

**Files:**
- Create: `src/lib/auth/session-policy.ts`, `src/lib/auth/session-policy.test.ts`, `src/lib/auth/session.ts`, `src/lib/auth/guard.ts`, `vitest.integration.config.ts`, `src/test/global-setup.ts`, `src/test/int-setup.ts`, `src/test/factories.ts`, `src/lib/auth/session.int.test.ts`

**Interfaces:**
- Consumes: `db`, `hashToken`, `generateToken`, `resolveEffectivePermissions`, `RequestMeta`, `ForbiddenError`, `UnauthorizedError`
- Produces:
  - `SESSION_IDLE_MS`, `SESSION_ABSOLUTE_MS`, `SESSION_TOUCH_MS`, `evaluateSession(s: { createdAt: Date; expiresAt: Date; lastSeenAt: Date }, userActive: boolean, now: Date): { valid: false } | { valid: true; touch: boolean; newExpiresAt: Date }`
  - `SESSION_COOKIE: string`, `type SessionUser = { id: string; email: string; name: string; roleId: string; roleKey: string; roleName: string; sessionId: string; permissions: ReadonlySet<PermissionKey> }`
  - `createSession(userId: string, meta: RequestMeta, now?: Date): Promise<{ token: string; sessionId: string; expiresAt: Date }>`, `loadSessionByToken(token: string, now?: Date): Promise<SessionUser | null>`, `getSession(): Promise<SessionUser | null>`, `setSessionCookie(token: string): Promise<void>`, `clearSessionCookie(): Promise<void>`, `destroySession(sessionId: string): Promise<void>`, `destroyUserSessions(userId: string, exceptSessionId?: string): Promise<number>`
  - `requireUser(): Promise<SessionUser>`, `requireActionUser(): Promise<SessionUser>`, `requirePermission(key: PermissionKey): Promise<SessionUser>`, `requirePagePermission(key: PermissionKey): Promise<SessionUser>`, `can(user: Pick<SessionUser, "permissions">, key: PermissionKey): boolean`

- [ ] **Step 1: Write the failing session-policy test**

```ts
// src/lib/auth/session-policy.test.ts
import { describe, expect, it } from "vitest";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, evaluateSession } from "./session-policy";

const HOUR = 3_600_000;
const t0 = new Date("2026-09-01T00:00:00Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("evaluateSession", () => {
  const fresh = { createdAt: t0, lastSeenAt: t0, expiresAt: at(SESSION_IDLE_MS) };

  it("accepts a fresh session without touching it", () => {
    expect(evaluateSession(fresh, true, at(HOUR))).toEqual({ valid: true, touch: false, newExpiresAt: at(HOUR + SESSION_IDLE_MS) });
  });
  it("touches once more than a day has passed since last seen", () => {
    const v = evaluateSession(fresh, true, at(25 * HOUR));
    expect(v).toEqual({ valid: true, touch: true, newExpiresAt: at(25 * HOUR + SESSION_IDLE_MS) });
  });
  it("rejects after the idle expiry", () => {
    expect(evaluateSession(fresh, true, at(SESSION_IDLE_MS + 1)).valid).toBe(false);
  });
  it("never extends past the absolute lifetime", () => {
    const old = { createdAt: t0, lastSeenAt: at(SESSION_ABSOLUTE_MS - 2 * 24 * HOUR), expiresAt: at(SESSION_ABSOLUTE_MS) };
    const v = evaluateSession(old, true, at(SESSION_ABSOLUTE_MS - HOUR));
    expect(v).toEqual({ valid: true, touch: true, newExpiresAt: at(SESSION_ABSOLUTE_MS) });
    expect(evaluateSession(old, true, at(SESSION_ABSOLUTE_MS)).valid).toBe(false);
  });
  it("rejects sessions of deactivated users", () => {
    expect(evaluateSession(fresh, false, at(HOUR)).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run src/lib/auth/session-policy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `session-policy.ts`**

```ts
// src/lib/auth/session-policy.ts
const DAY = 86_400_000;
export const SESSION_IDLE_MS = 7 * DAY;
export const SESSION_ABSOLUTE_MS = 30 * DAY;
export const SESSION_TOUCH_MS = DAY;

export function evaluateSession(
  s: { createdAt: Date; expiresAt: Date; lastSeenAt: Date },
  userActive: boolean,
  now: Date,
): { valid: false } | { valid: true; touch: boolean; newExpiresAt: Date } {
  const hardLimit = s.createdAt.getTime() + SESSION_ABSOLUTE_MS;
  if (!userActive || now.getTime() >= s.expiresAt.getTime() || now.getTime() >= hardLimit) return { valid: false };
  const touch = now.getTime() - s.lastSeenAt.getTime() > SESSION_TOUCH_MS;
  const newExpiresAt = new Date(Math.min(now.getTime() + SESSION_IDLE_MS, hardLimit));
  return { valid: true, touch, newExpiresAt };
}
```

Run: `npx vitest run src/lib/auth/session-policy.test.ts` → 5 PASS.

- [ ] **Step 4: Implement `session.ts` and `guard.ts`**

```ts
// src/lib/auth/session.ts
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import type { RequestMeta } from "@/lib/request-meta";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { resolveEffectivePermissions } from "@/lib/rbac/resolve";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, evaluateSession } from "./session-policy";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-gfg_session" : "gfg_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  sessionId: string;
  permissions: ReadonlySet<PermissionKey>;
};

export async function createSession(userId: string, meta: RequestMeta, now: Date = new Date()) {
  const token = generateToken();
  const sessionId = hashToken(token);
  const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
  await db.session.create({
    data: { id: sessionId, userId, expiresAt, createdAt: now, lastSeenAt: now, ip: meta.ip, userAgent: meta.userAgent },
  });
  return { token, sessionId, expiresAt };
}

export async function loadSessionByToken(token: string, now: Date = new Date()): Promise<SessionUser | null> {
  const sessionId = hashToken(token);
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: { include: { role: { include: { permissions: true } }, permissionOverrides: true } } },
  });
  if (!session) return null;

  const verdict = evaluateSession(session, session.user.isActive, now);
  if (!verdict.valid) {
    await db.session.deleteMany({ where: { id: sessionId } });
    return null;
  }
  if (verdict.touch) {
    await db.session.update({ where: { id: sessionId }, data: { lastSeenAt: now, expiresAt: verdict.newExpiresAt } });
  }

  const { user } = session;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleId: user.roleId,
    roleKey: user.role.key,
    roleName: user.role.name,
    sessionId,
    permissions: resolveEffectivePermissions({
      roleKey: user.role.key,
      rolePermissionKeys: user.role.permissions.map((p) => p.permissionKey),
      overrides: user.permissionOverrides,
    }),
  };
}

/** Request-scoped: every call within one render/action shares the result. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? loadSessionByToken(token) : null;
});

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_ABSOLUTE_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function destroySession(sessionId: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sessionId } });
}

export async function destroyUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return count;
}
```

```ts
// src/lib/auth/guard.ts
import "server-only";
import { forbidden, redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { getSession, type SessionUser } from "./session";

export function can(user: Pick<SessionUser, "permissions">, key: PermissionKey): boolean {
  return user.permissions.has(key);
}

/** Pages/layouts: redirect to sign-in when there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/admin/login");
  return user;
}

/** Pages: sign-in redirect, then the 403 view when the permission is missing. */
export async function requirePagePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, key)) forbidden();
  return user;
}

/** Server Actions and route handlers: throw typed errors that runAction() turns into messages. */
export async function requireActionUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await requireActionUser();
  if (!can(user, key)) throw new ForbiddenError();
  return user;
}
```

- [ ] **Step 5: Create the integration-test harness**

```ts
// vitest.integration.config.ts
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

const env = loadEnv("test", process.cwd(), "");
if (!env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    setupFiles: ["src/test/int-setup.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: env.TEST_DATABASE_URL, NODE_ENV: "test" },
  },
});
```

```ts
// src/test/global-setup.ts
import { execSync } from "node:child_process";

export default function setup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env } });
}
```

```ts
// src/test/int-setup.ts
import { afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";

beforeEach(async () => {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
});

afterAll(async () => {
  await db.$disconnect();
});
```

```ts
// src/test/factories.ts
import { db } from "@/lib/db";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { syncPermissions } from "@/lib/rbac/sync";

let counter = 0;

export async function createAdmin(opts: {
  roleKey?: string;
  permissions?: PermissionKey[];
  overrides?: { permissionKey: PermissionKey; effect: "GRANT" | "DENY" }[];
  isActive?: boolean;
} = {}) {
  await syncPermissions(db);
  counter += 1;
  const role = await db.role.create({
    data: {
      key: opts.roleKey ?? `role_${counter}`,
      name: `Role ${counter}`,
      permissions: { create: (opts.permissions ?? []).map((permissionKey) => ({ permissionKey })) },
    },
  });
  return db.adminUser.create({
    data: {
      email: `admin${counter}@example.test`,
      name: `Admin ${counter}`,
      passwordHash: "unused",
      roleId: role.id,
      isActive: opts.isActive ?? true,
      permissionOverrides: { create: opts.overrides ?? [] },
    },
  });
}
```

- [ ] **Step 6: Write the integration tests**

```ts
// src/lib/auth/session.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { createAdmin } from "@/test/factories";
import { SESSION_IDLE_MS } from "./session-policy";

let cookieToken: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "gfg_session" && cookieToken ? { name, value: cookieToken } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));

const { createSession, loadSessionByToken, destroyUserSessions } = await import("./session");
const { requirePermission } = await import("./guard");
const meta = { ip: "127.0.0.1", userAgent: "vitest" };

beforeEach(() => {
  cookieToken = undefined;
});

describe("sessions", () => {
  it("loads the user with role permissions", async () => {
    const admin = await createAdmin({ permissions: ["dashboard.view", "events.create"] });
    const { token } = await createSession(admin.id, meta);
    const user = await loadSessionByToken(token);
    expect(user?.email).toBe(admin.email);
    expect([...(user?.permissions ?? [])].sort()).toEqual(["dashboard.view", "events.create"]);
  });

  it("applies grant and deny overrides", async () => {
    const admin = await createAdmin({
      permissions: ["dashboard.view", "events.delete"],
      overrides: [{ permissionKey: "events.delete", effect: "DENY" }, { permissionKey: "logs.view", effect: "GRANT" }],
    });
    const { token } = await createSession(admin.id, meta);
    const user = await loadSessionByToken(token);
    expect(user?.permissions.has("events.delete")).toBe(false);
    expect(user?.permissions.has("logs.view")).toBe(true);
  });

  it("gives the super admin role every permission", async () => {
    const admin = await createAdmin({ roleKey: "super_admin" });
    const { token } = await createSession(admin.id, meta);
    expect((await loadSessionByToken(token))?.permissions.has("admins.manage")).toBe(true);
  });

  it("rejects and deletes expired sessions", async () => {
    const admin = await createAdmin();
    const start = new Date("2026-01-01T00:00:00Z");
    const { token, sessionId } = await createSession(admin.id, meta, start);
    expect(await loadSessionByToken(token, new Date(start.getTime() + SESSION_IDLE_MS + 1))).toBeNull();
    expect(await db.session.findUnique({ where: { id: sessionId } })).toBeNull();
  });

  it("rejects sessions of deactivated admins", async () => {
    const admin = await createAdmin({ isActive: false });
    const { token } = await createSession(admin.id, meta);
    expect(await loadSessionByToken(token)).toBeNull();
  });

  it("touches lastSeenAt after a day", async () => {
    const admin = await createAdmin();
    const start = new Date("2026-01-01T00:00:00Z");
    const { token, sessionId } = await createSession(admin.id, meta, start);
    const later = new Date(start.getTime() + 26 * 3_600_000);
    await loadSessionByToken(token, later);
    const row = await db.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row.lastSeenAt.toISOString()).toBe(later.toISOString());
  });

  it("destroys other sessions but keeps the current one", async () => {
    const admin = await createAdmin();
    const a = await createSession(admin.id, meta);
    await createSession(admin.id, meta);
    await createSession(admin.id, meta);
    expect(await destroyUserSessions(admin.id, a.sessionId)).toBe(2);
    expect(await loadSessionByToken(a.token)).not.toBeNull();
  });

  it("returns null for unknown tokens", async () => {
    expect(await loadSessionByToken("nope")).toBeNull();
  });
});

describe("requirePermission", () => {
  it("throws UnauthorizedError without a session cookie", async () => {
    await expect(requirePermission("events.create")).rejects.toBeInstanceOf(UnauthorizedError);
  });
  it("throws ForbiddenError when the permission is missing", async () => {
    const admin = await createAdmin({ permissions: ["dashboard.view"] });
    cookieToken = (await createSession(admin.id, meta)).token;
    await expect(requirePermission("events.create")).rejects.toBeInstanceOf(ForbiddenError);
  });
  it("returns the user when permitted", async () => {
    const admin = await createAdmin({ permissions: ["events.create"] });
    cookieToken = (await createSession(admin.id, meta)).token;
    expect((await requirePermission("events.create")).id).toBe(admin.id);
  });
});
```

- [ ] **Step 7: Run integration tests**

Run: `npm run test:int`
Expected: migrations deploy to the test DB; 11 tests PASS.
If the run fails with `cache is not a function` (React's non-server build lacking `cache`), change the `getSession` definition in `session.ts` to:
```ts
const memo: <F extends (...args: never[]) => unknown>(fn: F) => F = typeof cache === "function" ? cache : (fn) => fn;
export const getSession = memo(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? loadSessionByToken(token) : null;
});
```
and rerun.

- [ ] **Step 8: Run unit tests and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(auth): add DB sessions, permission guards and integration tests"
```

---

### Task 9: Brand tokens, login/logout, admin shell, dashboard, account, security headers

**Files:**
- Create: `public/brand/logo.png`, `public/brand/logo.webp`, `src/app/icon.png`, `src/app/apple-icon.png`, `src/components/brand/logo-tile.tsx`, `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/label.tsx`, `src/components/ui/form-message.tsx`, `src/server/actions/auth.ts`, `src/server/actions/account.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/login/login-form.tsx`, `src/app/admin/(panel)/layout.tsx`, `src/app/admin/(panel)/page.tsx`, `src/app/admin/(panel)/account/page.tsx`, `src/app/admin/(panel)/account/account-forms.tsx`, `src/components/admin/nav-items.ts`, `src/components/admin/sidebar.tsx`, `src/components/admin/admin-shell.tsx`, `src/app/forbidden.tsx`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `next.config.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–8.
- Produces: `loginAction(prev: LoginState, fd: FormData): Promise<LoginState>` with `type LoginState = { error?: string; email?: string } | undefined`; `logoutAction(): Promise<void>`; `updateProfileAction`, `changePasswordAction` (both `(prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>`); `revokeSessionAction(fd: FormData): Promise<void>`; `signOutOtherSessionsAction(): Promise<void>`; `ADMIN_NAV: AdminNavItem[]` (`{ href: string; label: string; icon: LucideIcon; permission: PermissionKey }`); `<LogoTile size="sm" | "md" | "lg" />`; UI primitives `Button` (`variant: "primary" | "secondary" | "ghost" | "danger"`, `size: "sm" | "md"`), `Input`, `Label`, `FormMessage`.

- [ ] **Step 1: Generate brand assets from the transparent logo**

```bash
magick docs/reference/logo-transparent.png -resize 512x512 -background none -gravity center -extent 512x512 public/brand/logo.png
magick public/brand/logo.png -quality 90 -define webp:alpha-quality=100 public/brand/logo.webp
magick -size 512x512 xc:none -fill "#EEF4EF" -draw "roundrectangle 0,0 511,511 112,112" \( public/brand/logo.png -resize 420x420 \) -gravity center -composite src/app/icon.png
magick -size 180x180 xc:"#EEF4EF" \( public/brand/logo.png -resize 150x150 \) -gravity center -composite src/app/apple-icon.png
rm -f src/app/favicon.ico
```

- [ ] **Step 2: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-night: #08120d;
  --color-pine: #0d1b14;
  --color-surface: #112219;
  --color-raised: #172c21;
  --color-line: #23392c;
  --color-frost: #e6efe8;
  --color-muted: #93a89a;
  --color-brand: #2f8d46;
  --color-leaf: #5cc97b;
  --color-mint: #bdf3cb;
  --color-amber: #f2b84b;
  --color-danger: #f26d6d;
  --color-tile: #eef4ef;

  --font-display: var(--font-bricolage), ui-sans-serif, system-ui, sans-serif;
  --font-sans: var(--font-geist), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, "SFMono-Regular", monospace;
}

html {
  color-scheme: dark;
  background: var(--color-night);
}

body {
  background: var(--color-night);
  color: var(--color-frost);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  text-wrap: balance;
}

:focus-visible {
  outline: 2px solid var(--color-mint);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Replace `src/app/layout.tsx` and `src/app/page.tsx`**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: "GFG Student Chapter", template: "%s · GFG Student Chapter" },
  description: "Workshops, hackathons and a community of student builders.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx — temporary until the public shell lands in phase 1b
import { LogoTile } from "@/components/brand/logo-tile";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="grid justify-items-center gap-6 text-center">
        <LogoTile size="lg" priority />
        <h1 className="font-display text-4xl font-extrabold tracking-tight">GeeksforGeeks Student Chapter</h1>
        <p className="max-w-md text-muted">Our new website is on its way.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create brand + UI primitives**

```tsx
// src/components/brand/logo-tile.tsx
import { cn } from "@/lib/utils/cn";

const SIZES = {
  sm: { box: "size-10 rounded-[10px] p-1", px: 32 },
  md: { box: "size-14 rounded-[14px] p-1.5", px: 44 },
  lg: { box: "size-40 rounded-[28px] p-4 shadow-[0_0_0_1px_rgb(189_243_203/0.45),0_24px_60px_-18px_rgb(92_201_123/0.35)]", px: 128 },
} as const;

/** The original logo, never recoloured, always on the light tile. */
export function LogoTile({ size = "sm", priority = false, className }: { size?: keyof typeof SIZES; priority?: boolean; className?: string }) {
  const s = SIZES[size];
  return (
    <span className={cn("grid shrink-0 place-items-center bg-tile shadow-[0_0_0_1px_rgb(189_243_203/0.35)]", s.box, className)}>
      <picture>
        <source srcSet="/brand/logo.webp" type="image/webp" />
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset with its own WebP source */}
        <img
          src="/brand/logo.png"
          alt="GeeksforGeeks Student Chapter"
          width={s.px}
          height={s.px}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-contain"
        />
      </picture>
    </span>
  );
}
```

```tsx
// src/components/ui/button.tsx
import { cn } from "@/lib/utils/cn";

const VARIANTS = {
  primary: "bg-leaf text-night hover:bg-[#72d48e] shadow-[0_10px_30px_-12px_rgb(92_201_123/0.7)]",
  secondary: "border border-line bg-raised text-frost hover:bg-[#1d3527]",
  ghost: "text-muted hover:bg-raised hover:text-frost",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
} as const;

const SIZES = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm" } as const;

export type ButtonProps = React.ComponentProps<"button"> & { variant?: keyof typeof VARIANTS; size?: keyof typeof SIZES };

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,transform,box-shadow] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
```

```tsx
// src/components/ui/input.tsx
import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-line bg-night px-3 text-sm text-frost placeholder:text-muted/60",
        "transition-colors focus-visible:border-leaf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/30",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
```

```tsx
// src/components/ui/label.tsx
import { cn } from "@/lib/utils/cn";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-frost", className)} {...props} />;
}
```

```tsx
// src/components/ui/form-message.tsx
import { cn } from "@/lib/utils/cn";

export function FormMessage({ tone = "error", children, id }: { tone?: "error" | "success"; children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role={tone === "error" ? "alert" : "status"} className={cn("text-[13px]", tone === "error" ? "text-danger" : "text-leaf")}>
      {children}
    </p>
  );
}
```

- [ ] **Step 5: Create auth actions**

```ts
// src/server/actions/auth.ts
"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeAdminRedirect } from "@/lib/auth/redirect";
import { clearSessionCookie, createSession, destroySession, getSession, setSessionCookie } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import { loginIpLimiter, loginLimiter } from "@/lib/security/limiters";

export type LoginState = { error?: string; email?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});

let dummyHash: Promise<string> | undefined;
/** Verifying against a throwaway hash keeps timing equal whether or not the email exists. */
function getDummyHash() {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  return dummyHash;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const typedEmail = String(formData.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { error: "Enter your email and password.", email: typedEmail };
  const { email, password } = parsed.data;

  const meta = await getRequestMeta();
  const ip = meta.ip ?? "unknown";
  const perEmail = loginLimiter.check(`${ip}:${email}`);
  const perIp = loginIpLimiter.check(ip);
  if (!perEmail.allowed || !perIp.allowed) {
    const minutes = Math.ceil(Math.max(perEmail.retryAfterMs, perIp.retryAfterMs) / 60_000);
    return { error: `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, email };
  }

  const user = await db.adminUser.findUnique({ where: { email } });
  const passwordOk = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !passwordOk || !user.isActive) {
    await writeAuditLog(db, { actor: null, action: "auth.login_failed", target: { type: "AdminUser", id: user?.id, label: email }, meta });
    return { error: "Email or password is incorrect.", email };
  }

  loginLimiter.reset(`${ip}:${email}`);
  const { token } = await createSession(user.id, meta);
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog(db, { actor: { id: user.id, name: user.name }, action: "auth.login", target: { type: "AdminUser", id: user.id, label: user.email }, meta });
  await setSessionCookie(token);
  redirect(safeAdminRedirect(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  const user = await getSession();
  if (user) {
    await destroySession(user.sessionId);
    await writeAuditLog(db, {
      actor: { id: user.id, name: user.name },
      action: "auth.logout",
      target: { type: "AdminUser", id: user.id, label: user.email },
      meta: await getRequestMeta(),
    });
  }
  await clearSessionCookie();
  redirect("/admin/login");
}
```

- [ ] **Step 6: Create account actions**

```ts
// src/server/actions/account.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionResult } from "@/lib/actions";
import { writeAuditLog } from "@/lib/audit";
import { requireActionUser } from "@/lib/auth/guard";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { destroyUserSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request-meta";

const profileSchema = z.object({ name: z.string().trim().min(1, "Enter your name.").max(80, "Keep it under 80 characters.") });

export async function updateProfileAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const { name } = profileSchema.parse({ name: formData.get("name") });
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: user.id }, data: { name } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name }, action: "account.profile_updated",
        target: { type: "AdminUser", id: user.id, label: user.email }, metadata: { from: user.name, to: name },
        meta: await getRequestMeta(),
      });
    });
    revalidatePath("/admin", "layout");
    return null;
  });
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string(),
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.next);
    if (problem) ctx.addIssue({ code: "custom", path: ["next"], message: problem });
    if (v.next !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
  });

export async function changePasswordAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireActionUser();
    const input = passwordSchema.parse({ current: formData.get("current"), next: formData.get("next"), confirm: formData.get("confirm") });
    const record = await db.adminUser.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(record.passwordHash, input.current))) {
      throw new UserError("Current password is incorrect.", { current: ["Current password is incorrect."] });
    }
    await db.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.next) } });
      await writeAuditLog(tx, {
        actor: { id: user.id, name: user.name }, action: "account.password_changed",
        target: { type: "AdminUser", id: user.id, label: user.email }, meta: await getRequestMeta(),
      });
    });
    await destroyUserSessions(user.id, user.sessionId);
    revalidatePath("/admin/account");
    return null;
  });
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await requireActionUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId || sessionId === user.sessionId) return;
  const { count } = await db.session.deleteMany({ where: { id: sessionId, userId: user.id } });
  if (count) {
    await writeAuditLog(db, {
      actor: { id: user.id, name: user.name }, action: "account.session_revoked",
      target: { type: "AdminUser", id: user.id, label: user.email }, meta: await getRequestMeta(),
    });
  }
  revalidatePath("/admin/account");
}

export async function signOutOtherSessionsAction(): Promise<void> {
  const user = await requireActionUser();
  const count = await destroyUserSessions(user.id, user.sessionId);
  await writeAuditLog(db, {
    actor: { id: user.id, name: user.name }, action: "account.sessions_revoked",
    target: { type: "AdminUser", id: user.id, label: user.email }, metadata: { count }, meta: await getRequestMeta(),
  });
  revalidatePath("/admin/account");
}
```

- [ ] **Step 7: Create login page and form**

```tsx
// src/app/admin/login/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoTile } from "@/components/brand/logo-tile";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSession()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <svg aria-hidden="true" viewBox="0 0 620 620" className="pointer-events-none absolute -right-40 top-1/2 size-[680px] -translate-y-1/2 opacity-40">
        <circle cx="230" cy="310" r="190" fill="none" stroke="#2F8D46" strokeOpacity=".45" strokeWidth="1.2" />
        <circle cx="390" cy="310" r="190" fill="none" stroke="#2F8D46" strokeOpacity=".45" strokeWidth="1.2" />
        <circle cx="230" cy="310" r="260" fill="none" stroke="#23392C" />
        <circle cx="390" cy="310" r="260" fill="none" stroke="#23392C" />
      </svg>
      <section className="relative w-full max-w-sm rounded-3xl border border-line bg-surface/90 p-8 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.8)] backdrop-blur">
        <div className="mb-8 grid justify-items-start gap-5">
          <LogoTile size="md" priority />
          <div className="grid gap-1">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">Chapter admin</p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Sign in</h1>
          </div>
        </div>
        <LoginForm next={next} />
      </section>
    </main>
  );
}
```

```tsx
// src/app/admin/login/login-form.tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? "/admin"} />
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.email} aria-invalid={!!state?.error} aria-describedby="login-error" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!state?.error} aria-describedby="login-error" />
      </div>
      <FormMessage id="login-error">{state?.error}</FormMessage>
      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted">Accounts are invite-only. Ask a super admin for an invite link.</p>
    </form>
  );
}
```

- [ ] **Step 8: Create nav items, sidebar, shell, panel layout and dashboard**

```ts
// src/components/admin/nav-items.ts
import { LayoutDashboard, type LucideIcon } from "lucide-react";
import type { PermissionKey } from "@/lib/rbac/permissions";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon; permission: PermissionKey };

/** Only list screens that exist. Later phases append here. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
];
```

Icons are functions and cannot cross the server→client boundary as props, so the sidebar is a server component; only the active-link highlight (`NavLink`) and the mobile drawer (`AdminShell`) are client components. Also add `src/components/admin/nav-link.tsx` to this task's files.

```tsx
// src/components/admin/sidebar.tsx
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { LogoTile } from "@/components/brand/logo-tile";
import { logoutAction } from "@/server/actions/auth";
import type { AdminNavItem } from "./nav-items";
import { NavLink } from "./nav-link";

export function Sidebar({ items, user }: { items: AdminNavItem[]; user: { name: string; roleName: string } }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/admin" className="flex items-center gap-3 rounded-xl p-1">
        <LogoTile size="sm" />
        <span className="grid leading-tight">
          <span className="text-sm font-semibold">GFG Chapter</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Admin</span>
        </span>
      </Link>
      <nav aria-label="Admin" className="grid gap-1">
        {items.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href}>
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto grid gap-2 rounded-2xl border border-line bg-night/60 p-3">
        <div className="grid leading-tight">
          <span className="truncate text-sm font-semibold">{user.name}</span>
          <span className="text-xs text-muted">{user.roleName}</span>
        </div>
        <div className="flex gap-1">
          <NavLink href="/admin/account" compact>
            <UserRound aria-hidden="true" className="size-4" />
            Account
          </NavLink>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-raised hover:text-frost">
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

```tsx
// src/components/admin/nav-link.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function NavLink({ href, compact = false, children }: { href: string; compact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg text-sm transition-colors",
        compact ? "h-8 px-2.5 text-[13px]" : "h-9 px-3",
        active ? "bg-raised text-frost shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-muted hover:bg-raised/60 hover:text-frost",
      )}
    >
      {children}
    </Link>
  );
}
```

```tsx
// src/components/admin/admin-shell.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Sidebar content is rendered on the server and passed in; this only handles the mobile drawer. */
export function AdminShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-leaf focus:px-3 focus:py-2 focus:text-night">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-pine lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-pine/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="text-sm font-semibold">GFG Chapter Admin</span>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-frost">
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-night/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-line bg-pine">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-raised hover:text-frost">
              <X className="size-5" aria-hidden="true" />
            </button>
            {sidebar}
          </div>
        </div>
      )}
      <main id="admin-main" className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">{children}</main>
    </div>
  );
}
```

```tsx
// src/app/admin/(panel)/layout.tsx
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_NAV } from "@/components/admin/nav-items";
import { Sidebar } from "@/components/admin/sidebar";
import { can, requireUser } from "@/lib/auth/guard";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = ADMIN_NAV.filter((item) => can(user, item.permission));
  return <AdminShell sidebar={<Sidebar items={items} user={user} />}>{children}</AdminShell>;
}
```

```tsx
// src/app/admin/(panel)/page.tsx
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requirePagePermission } from "@/lib/auth/guard";

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard.view");
  const groups = new Map<string, string[]>();
  for (const p of PERMISSIONS) {
    if (!user.permissions.has(p.key)) continue;
    groups.set(p.group, [...(groups.get(p.group) ?? []), p.description]);
  }
  return (
    <div className="grid max-w-4xl gap-8">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">Dashboard</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="text-muted">You're signed in as <span className="text-frost">{user.roleName}</span>.</p>
      </header>
      <section aria-labelledby="access" className="rounded-2xl border border-line bg-surface p-6">
        <h2 id="access" className="font-display text-lg font-semibold">Your access</h2>
        <dl className="mt-4 grid gap-5 sm:grid-cols-2">
          {[...groups].map(([group, items]) => (
            <div key={group} className="grid gap-1.5">
              <dt className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{group}</dt>
              {items.map((d) => <dd key={d} className="text-sm">{d}</dd>)}
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
```

- [ ] **Step 9: Create the account page**

```tsx
// src/app/admin/(panel)/account/page.tsx
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils/time";
import { revokeSessionAction, signOutOtherSessionsAction } from "@/server/actions/account";
import { PasswordForm, ProfileForm } from "./account-forms";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const sessions = await db.session.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" } });
  return (
    <div className="grid max-w-3xl gap-8">
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">Account</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Your account</h1>
        <p className="text-muted">{user.email}</p>
      </header>

      <section aria-labelledby="profile" className="grid gap-4 rounded-2xl border border-line bg-surface p-6">
        <h2 id="profile" className="font-display text-lg font-semibold">Profile</h2>
        <ProfileForm name={user.name} />
      </section>

      <section aria-labelledby="password" className="grid gap-4 rounded-2xl border border-line bg-surface p-6">
        <div className="grid gap-1">
          <h2 id="password" className="font-display text-lg font-semibold">Password</h2>
          <p className="text-sm text-muted">Changing your password signs you out everywhere else.</p>
        </div>
        <PasswordForm />
      </section>

      <section aria-labelledby="sessions" className="grid gap-4 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="sessions" className="font-display text-lg font-semibold">Where you're signed in</h2>
          {sessions.length > 1 && (
            <form action={signOutOtherSessionsAction}>
              <Button type="submit" variant="secondary" size="sm">Sign out other sessions</Button>
            </form>
          )}
        </div>
        <ul className="divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm">{s.userAgent ?? "Unknown device"}</span>
                <span className="font-mono text-xs text-muted">
                  {s.ip ?? "unknown IP"} · active {timeAgo(s.lastSeenAt)}
                </span>
              </div>
              {s.id === user.sessionId ? (
                <span className="rounded-full border border-leaf/30 bg-leaf/10 px-2.5 py-1 text-xs text-leaf">This device</span>
              ) : (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <Button type="submit" variant="ghost" size="sm">Sign out</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

```tsx
// src/app/admin/(panel)/account/account-forms.tsx
"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/actions";
import { changePasswordAction, updateProfileAction } from "@/server/actions/account";

function fieldError(state: ActionResult | undefined, field: string) {
  return state && !state.ok ? state.fieldErrors?.[field]?.[0] : undefined;
}

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, undefined);
  const nameError = fieldError(state, "name");
  return (
    <form action={action} className="grid gap-4 sm:max-w-sm">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" name="name" defaultValue={name} maxLength={80} required aria-invalid={!!nameError} aria-describedby="name-error" />
        <FormMessage id="name-error">{nameError}</FormMessage>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save name"}</Button>
        {state?.ok && <FormMessage tone="success">Name saved.</FormMessage>}
        {state && !state.ok && !nameError && <FormMessage>{state.error}</FormMessage>}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  const fields = [
    { name: "current", label: "Current password", autoComplete: "current-password" },
    { name: "next", label: "New password", autoComplete: "new-password", hint: "At least 12 characters. A short sentence works well." },
    { name: "confirm", label: "Confirm new password", autoComplete: "new-password" },
  ];
  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:max-w-sm">
      {fields.map((f) => {
        const error = fieldError(state, f.name);
        return (
          <div key={f.name} className="grid gap-1.5">
            <Label htmlFor={`pw-${f.name}`}>{f.label}</Label>
            <Input id={`pw-${f.name}`} name={f.name} type="password" autoComplete={f.autoComplete} required aria-invalid={!!error} aria-describedby={`pw-${f.name}-msg`} />
            {f.hint && !error && <p className="text-xs text-muted">{f.hint}</p>}
            <FormMessage id={`pw-${f.name}-msg`}>{error}</FormMessage>
          </div>
        );
      })}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Changing…" : "Change password"}</Button>
        {state?.ok && <FormMessage tone="success">Password changed. Other sessions were signed out.</FormMessage>}
        {state && !state.ok && !state.fieldErrors && <FormMessage>{state.error}</FormMessage>}
      </div>
    </form>
  );
}
```

- [ ] **Step 10: Create the 403 view**

```tsx
// src/app/forbidden.tsx
import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-4">
      <div className="grid max-w-md gap-3 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-amber">403</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">You don't have access to this page</h1>
        <p className="text-muted">Ask a super admin to add the permission to your role if you need it.</p>
        <Link href="/admin" className="justify-self-center text-sm text-leaf underline-offset-4 hover:underline">Back to dashboard</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 11: Replace `next.config.ts`**

```ts
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  experimental: { authInterrupts: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

- [ ] **Step 12: Typecheck, lint, test, build**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run test:int && npm run build`
Expected: all green; build output lists `/admin`, `/admin/account`, `/admin/login`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(admin): add sign-in, admin shell, dashboard, account page and security headers"
```

---

### Task 10: End-to-end verification in the browser

**Files:** none (verification only; fix anything found, then commit fixes)

- [ ] **Step 1: Start the app** — `npm run dev` (background). Confirm `curl -sI localhost:3000/admin` returns `307` to `/admin/login` and includes the `content-security-policy` header.
- [ ] **Step 2: Sign in** with `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` from `.env` in Chrome. Expected: lands on the dashboard showing "Super Admin" and all permission groups.
- [ ] **Step 3: Wrong password ×6** for the same email (in a private window). Expected: "Email or password is incorrect." five times, then "Too many sign-in attempts. Try again in 15 minutes."
- [ ] **Step 4: Account page** — change name (sidebar updates), change password with a mismatched confirm (inline error), then a valid change (success message; other session revoked).
- [ ] **Step 5: Mobile width (400px)** — menu button opens the drawer, Escape/overlay closes it, no horizontal scroll.
- [ ] **Step 6: Keyboard** — Tab from page load reaches "Skip to content", nav links, account, sign out, with visible mint focus rings.
- [ ] **Step 7: Audit rows** — `PGPASSWORD=postgres PGSSLMODE=disable psql -h localhost -p 51214 -U postgres -d template1 -c 'SELECT action, "actorName", "targetLabel" FROM "AuditLog" ORDER BY "createdAt"'` shows login_failed, login, profile_updated, password_changed, logout entries. (`PGSSLMODE=disable` is required: `prisma dev` never answers psql's SSL request and psql hangs.)

**Execution note (2026-09-11):** automated browser sessions must not type passwords, so login behaviour (success, wrong password, lockout, safe redirect, deactivated user) is covered by `src/server/actions/auth.int.test.ts`; authenticated pages were checked with curl using sessions inserted by a throwaway script in `data/` (gitignored); the human does the final in-browser sign-in pass.
- [ ] **Step 8: Sign out** returns to `/admin/login`; browser back does not show admin content.
- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "fix(admin): address issues found in phase 1a browser verification"
```
