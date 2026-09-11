# Phase 2 — Events Implementation Plan

> Executed inline. Lean format: file map, interfaces, test cases; code written once in the files.

**Goal:** Complete event management (create, edit, duplicate, draft/publish/unpublish/cancel/archive/restore/delete), poster pipeline, categories, global + per-event sponsors, public events list and detail with countdown, share, add-to-calendar, JSON-LD and OG, QR codes, public Sponsors page.

**Spec:** §5 (Event, EventCategory, Sponsor, EventSponsor), §6 (poster), §10 (SEO), §15 (QR), §16 (dashboard), §17 phase 2.

**Decision (2026-09-11):** registration modes in this phase are `NONE` and `EXTERNAL` only. `FORM` is added in Phase 3 together with the form engine, so no Register button ever points at nothing. The status logic already understands `FORM` so Phase 3 only adds wiring.

## Interfaces

- `src/lib/events/status.ts` — `EventDisplayStatus`, `registrationState(event, stats, now)`, `deriveEventStatus(event, stats, now)`, `STATUS_META`.
- `src/lib/events/format.ts` — `formatEventWhen(startIso, endIso, timeZone): { date, time, full }` (overnight events under 24h show one date, like the reference card).
- `src/lib/content/sanitize.ts` — `sanitizeRichText(html)`, `richTextToPlain(html, max)`; used on write **and** render.
- `src/lib/events/ics.ts` — `buildIcs(event)`.
- `src/lib/events/schema.ts` — `eventFormSchema` (local date-times in the site zone, repeaters, sponsors).
- `src/server/actions/events.ts` — `saveEventAction`, `duplicateEventAction`, `setEventLifecycleAction`, `deleteEventAction`.
- `src/server/actions/sponsors.ts`, `src/server/actions/categories.ts`.
- `src/lib/data/events.ts` — cached public queries (`listPublicEvents`, `getPublicEvent`), DTOs with ISO strings.
- `src/app/api/admin/qr/route.ts` — `?target=event:<id>|register:<id>&format=png|svg&branded=0|1`.
- Admin: `/admin/events`, `/admin/events/new`, `/admin/events/[id]`, `/admin/events/categories`, `/admin/sponsors`, `/admin/sponsors/[id]`.
- Public: `/events`, `/events/[slug]`, `/events/[slug]/calendar.ics`, `/sponsors`.

## Permissions

create/duplicate → `events.create`; edit, poster, sponsors on event, categories → `events.edit`; publish/unpublish/cancel/archive/restore → `events.publish`; delete → `events.delete`; global sponsors → `sponsors.manage`; QR → `events.edit`.

## Tests

- Status: every branch (draft, archived, cancelled, completed, ongoing, none, external open/closed by deadline, form full / not accepting / open, deadline defaults to start).
- Format: same day, overnight, multi-day, cross-year, UTC→IST.
- Sanitize: scripts/handlers/javascript: stripped, h1→h2, external links get rel+target, internal links untouched, images dropped; plain-text excerpt.
- ICS: escaping, UTC stamps, CRLF, line folding.
- Actions (integration): each permission guard, lifecycle transitions + audit + cache invalidation, duplicate gets new slug and DRAFT, slug uniqueness, end-before-start rejected, external mode needs a URL, sponsor links saved.

## Acceptance

Public pages 404 when EVENTS/SPONSORS pages are off; archived and draft events never public; OG uses `og.jpg`; JSON-LD valid; reduced-motion respected; images lazy except the detail hero; admin screens screenshot-checked.
