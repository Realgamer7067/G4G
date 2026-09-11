# Phase 3 — Forms & Registration Implementation Plan

> Executed inline. The form engine is the riskiest module in the project: it is built test-first in full (tests in `src/lib/forms/engine/*.test.ts`) before any builder or renderer UI exists.

**Goal:** Logic-driven multi-page forms (conditional fields, conditional options, page branching), a builder, publish/versioning, the two-pane wizard renderer from the user's reference, standalone `/forms/[slug]` and event registration (`/events/[slug]/register`), submission rules (windows, capacity, one-per-email, bot filtering), private file uploads, responses admin with search/filters/delete, CSV/XLSX export with injection guard, analytics, QR codes for forms.

**Spec:** §5 (Form, FormVersion, FormResponse, FormDailyStat), §7 (engine, versioning, renderer, submission, responses), §15 (QR), §17 phase 3. Reference: `docs/reference/form-wizard-reference.png`.

## Engine (`src/lib/forms/engine/`)

- `schema.ts` — Zod `formDefinitionSchema` (§7.1), `FIELD_TYPES`, `OPERATORS`, types `FormDefinition`, `Page`, `Block`, `Field`, `ContentBlock`, `Condition`, `ConditionGroup`, `Answers` (`Record<fieldId, string | string[] | number | null>`).
- `conditions.ts` — `evalCondition(condition, answers, field)`, `evalGroup(group, answers, fieldsById)`; operator semantics:
  - `equals`/`not_equals`: text compare (case-insensitive, trimmed); choice fields compare option ids; checkboxes `equals` = contains the option.
  - `contains`/`not_contains`: substring for text, membership for checkboxes.
  - `any_of`/`none_of`: value is a list of option ids.
  - `is_empty`/`is_filled`.
  - `gt`/`lt`: numbers (number, linear_scale, rating).
  - `before`/`after`: ISO date/time strings.
  - A condition on a hidden (or unanswered) field sees an empty value.
- `validate-definition.ts` — `validateDefinition(def) → { ok: true } | { ok: false; issues: { path: string; message: string }[] }`: unique ids; ≥1 input field; choice fields have ≥1 option; conditions reference only earlier fields; operators fit the field type; option-valued conditions reference existing options; branch/defaultNext targets are later pages or `submit`; scale min < max; custom patterns compile and are ≤ 200 chars.
- `evaluate.ts` — `evaluateForm(def, answers) → { path, visibleBlocks, visibleOptions, cleaned }` (§7.3). Terminates because jumps only go forward.
- `validate-submission.ts` — `validateSubmission(def, answers) → { ok: true; cleaned; path } | { ok: false; errors: Record<fieldId, string> }` and `validatePage(def, answers, pageId)` for step-by-step checks; normalises values (numbers as numbers, trimmed strings, checkbox arrays deduped).
- `display.ts` — `formatAnswer(field, value)` for review step, response detail and exports.

## Server

- `src/server/forms/definition.ts` — default definition for new forms, `parseDefinition(json)`.
- `src/server/actions/forms.ts` — `createFormAction`, `saveFormDraftAction` (autosave, validates shape only), `publishFormAction` (full `validateDefinition`, new `FormVersion`), `saveFormSettingsAction`, `duplicateFormAction`, `deleteFormAction`, `deleteResponsesAction`.
- `src/server/forms/submit.ts` — `submitResponse({ form, event?, answers, meta, startedAt, honeypot })`: windows, event rules, honeypot + ≥3 s fill time, rate limit, `validateSubmission`, one-per-email, capacity under `SELECT … FOR UPDATE` on the form row, file attachment, `FormDailyStat.submissions++`, cache invalidation for the event.
- `src/server/forms/files.ts` — magic-byte check via `file-type` (pdf, png, jpeg, webp, doc/docx, ppt/pptx, zip), 10 MB cap, PRIVATE storage, 24 h claim window.
- `src/lib/forms/export.ts` — `buildExportTable(versions, responses, timeZone)`, `safeCell(value)` (prefix `'` for `= + - @ \t \r`), `toCsv(table)`.
- `src/lib/forms/analytics.ts` — `dailySeries(dates, days, timeZone, now)`, `choiceBreakdown(def, responses)`.
- Routes: `POST /api/forms/[slug]/submit`, `POST /api/forms/[slug]/upload`, `POST /api/forms/[slug]/beacon`, `GET /api/admin/forms/[id]/export?format=csv|xlsx`, `GET /api/admin/files/[id]`; QR route gains `form:<id>` and FORM-mode `register:<id>`.

## UI

- Admin: `/admin/forms` (list), `/admin/forms/new`, `/admin/forms/[id]/build` (pages rail · page canvas · inspector with plain-language logic editor · live preview · autosave · publish with issue list), `/admin/forms/[id]/settings`, `/admin/forms/[id]/responses` (+ `/[responseId]`), analytics panel.
- Event editor gains `FORM` registration mode (pick a form).
- Public: `FormWizard` (two-pane card: cover + meta + stepper rail; `STEP n OF m` + progress; page blocks; review step with EDIT; `● DRAFT SAVED`; custom submit label; success screen with add-to-calendar for events; mobile header collapse), `/forms/[slug]`, `/events/[slug]/register`.

## Permissions

`forms.create` (create, duplicate), `forms.edit` (draft, publish, settings), `forms.delete`, `forms.responses.view` (list, detail, files), `forms.responses.export`, `forms.responses.delete`.

## Tests

- Engine unit tests (exhaustive): operators per type; hidden-field cascade; option visibility and pruning of now-hidden selections; branching (first match wins, default next, submit, skip pages); required only when visible; per-type validation; definition validation for every rule.
- Export: column union across versions, option labels, CSV quoting and injection guard.
- Integration: guards for every action; publish creates versions; submission accepts/rejects (closed, not yet open, deadline, full, duplicate email, honeypot, too fast, hidden-field values dropped); file claim; delete cascades files.
- **Capacity race:** tested for correctness on `prisma dev`; marked *unverified for true concurrency* until run against a multi-connection PostgreSQL server (see spec §13).
