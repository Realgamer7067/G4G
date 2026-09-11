import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { AreaChart } from "@/components/admin/area-chart";
import { BreakdownBars } from "@/components/admin/breakdown-bars";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { choiceBreakdown, dailySeries } from "@/lib/forms/analytics";
import { formatAnswer } from "@/lib/forms/engine/display";
import { CHOICE_TYPES, allFields, formDefinitionSchema, type Answers, type Field, type FormDefinition } from "@/lib/forms/engine/schema";
import { RESPONSES_PAGE_SIZE, buildResponseWhere, parseResponseFilters, responsesQuery } from "@/lib/forms/response-filters";
import { daysAgo } from "@/lib/utils/time";
import { formatInZone } from "@/lib/utils/timezone";
import { FormHeader } from "../form-header";
import { ResponsesTable } from "./responses-table";

export const metadata: Metadata = { title: "Responses" };

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-line bg-surface p-5">
      <span className="font-display text-3xl font-extrabold tabular-nums tracking-tight">{value}</span>
      <span className="text-sm text-muted">{label}</span>
      {hint && <span className="text-xs text-muted/80">{hint}</span>}
    </div>
  );
}

export default async function ResponsesPage({ params, searchParams }: PageProps<"/admin/forms/[id]/responses">) {
  const me = await requirePagePermission("forms.responses.view");
  const { id } = await params;
  const form = await db.form.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" } }, events: { select: { id: true, title: true } }, _count: { select: { responses: true } } },
  });
  if (!form) notFound();

  const { timezone } = await loadSiteSettings();
  const filters = parseResponseFilters(await searchParams);
  const where = buildResponseWhere(form.id, filters, timezone);
  const since = daysAgo(30, new Date());

  const [total, rows, recent, stats, sample] = await Promise.all([
    db.formResponse.count({ where }),
    db.formResponse.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip: (filters.page - 1) * RESPONSES_PAGE_SIZE,
      take: RESPONSES_PAGE_SIZE,
      include: { event: { select: { title: true } } },
    }),
    db.formResponse.findMany({ where: { formId: form.id, submittedAt: { gte: since } }, select: { submittedAt: true } }),
    db.formDailyStat.aggregate({ where: { formId: form.id }, _sum: { views: true, starts: true, submissions: true } }),
    db.formResponse.findMany({ where: { formId: form.id }, select: { data: true }, orderBy: { submittedAt: "desc" }, take: 2_000 }),
  ]);

  const defs = new Map<string, Map<string, Field>>();
  let latest: FormDefinition | null = null;
  for (const v of form.versions) {
    const parsed = formDefinitionSchema.safeParse(v.definition);
    if (!parsed.success) continue;
    latest ??= parsed.data;
    defs.set(v.id, new Map(allFields(parsed.data).map((f) => [f.id, f])));
  }
  latest ??= formDefinitionSchema.safeParse(form.draftDefinition).data ?? null;
  const fields = latest ? allFields(latest) : [];
  const columns = fields.filter((f) => !["long_text", "file", "email"].includes(f.type)).slice(0, 3);
  const choiceFields = fields.filter((f) => CHOICE_TYPES.has(f.type) || f.type === "yes_no").slice(0, 4);

  const series = dailySeries(recent.map((r) => r.submittedAt), 30, timezone);
  const last7 = series.slice(-7).reduce((s, d) => s + d.count, 0);
  const starts = stats._sum.starts ?? 0;
  const submissions = stats._sum.submissions ?? 0;
  const completion = starts > 0 ? `${Math.min(100, Math.round((submissions / starts) * 100))}%` : "—";
  const sampleAnswers = sample.map((s) => s.data as Answers);
  const showEvent = form.events.length > 0;

  const qs = responsesQuery(filters, 1);
  const exportHref = (format: "csv" | "xlsx") => `/api/admin/forms/${form.id}/export${qs ? `${qs}&` : "?"}format=${format}`;
  const pages = Math.max(1, Math.ceil(total / RESPONSES_PAGE_SIZE));
  const filtered = Boolean(filters.q || filters.from || filters.to || filters.event);

  return (
    <div className="grid max-w-6xl gap-8">
      <FormHeader user={me} form={form} active="responses" responseCount={form._count.responses} />

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Responses" value={form._count.responses} />
        <Tile label="In the last 7 days" value={last7} />
        <Tile label="Form views" value={stats._sum.views ?? 0} hint="Counted once per visit" />
        <Tile label="Completion rate" value={completion} hint="Submitted ÷ started" />
      </section>

      <section className="grid gap-6 rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:grid-cols-[1.5fr_1fr]">
        <AreaChart data={series} title="Responses, last 30 days" unit={["response", "responses"]} />
        {choiceFields.length > 0 ? (
          <div className="grid content-start gap-6">
            {choiceFields.map((f) => {
              const values = sampleAnswers.map((a) => a[f.id]);
              return <BreakdownBars key={f.id} title={f.label} rows={choiceBreakdown(f, values)} answered={values.filter((v) => v !== undefined && v !== null && v !== "").length} />;
            })}
          </div>
        ) : (
          <p className="self-center text-sm text-muted">Add a multiple-choice question to see a breakdown of answers here.</p>
        )}
      </section>

      <section aria-labelledby="list" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="list" className="font-display text-xl font-semibold">
            {filtered ? `${total} matching response${total === 1 ? "" : "s"}` : "All responses"}
          </h2>
          {can(me, "forms.responses.export") && total > 0 && (
            <div className="flex gap-2">
              <a href={exportHref("csv")} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 text-sm hover:bg-[#1d3527]">
                <Download className="size-4" aria-hidden="true" /> CSV
              </a>
              <a href={exportHref("xlsx")} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 text-sm hover:bg-[#1d3527]">
                <Download className="size-4" aria-hidden="true" /> Excel
              </a>
            </div>
          )}
        </div>

        <form method="get" className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto] lg:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="q">Search answers</Label>
            <Input id="q" name="q" defaultValue={filters.q} placeholder="Name, email, any answer…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" type="date" defaultValue={filters.from} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" type="date" defaultValue={filters.to} />
          </div>
          {showEvent ? (
            <div className="grid gap-1.5">
              <Label htmlFor="event">Event</Label>
              <Select id="event" name="event" defaultValue={filters.event}>
                <option value="">Any</option>
                {form.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <span className="hidden lg:block" />
          )}
          <div className="flex gap-2">
            <button type="submit" className="h-10 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
              Filter
            </button>
            {filtered && (
              <Link href={`/admin/forms/${form.id}/responses`} className="inline-flex h-10 items-center rounded-full px-3 text-sm text-muted hover:text-frost">
                Clear
              </Link>
            )}
          </div>
        </form>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">
            {filtered ? "No responses match these filters." : form.publishedVersionId ? "No responses yet. Share the form to start collecting them." : "Publish the form to start collecting responses."}
          </p>
        ) : (
          <ResponsesTable
            formId={form.id}
            headers={columns.map((c) => c.label)}
            showEvent={showEvent}
            canDelete={can(me, "forms.responses.delete")}
            rows={rows.map((r) => {
              const own = defs.get(r.versionId);
              const data = r.data as Answers;
              return {
                id: r.id,
                submitted: formatInZone(r.submittedAt, timezone, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }),
                email: r.email ?? "",
                event: r.event?.title ?? "",
                cells: columns.map((c) => formatAnswer(own?.get(c.id) ?? c, data[c.id])),
              };
            })}
          />
        )}

        {pages > 1 && (
          <nav aria-label="Pages" className="flex items-center justify-between text-sm">
            {filters.page > 1 ? (
              <Link href={`/admin/forms/${form.id}/responses${responsesQuery(filters, filters.page - 1)}`} className="rounded-full border border-line px-4 py-2 hover:border-leaf/40">
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted">
              Page {filters.page} of {pages}
            </span>
            {filters.page < pages ? (
              <Link href={`/admin/forms/${form.id}/responses${responsesQuery(filters, filters.page + 1)}`} className="rounded-full border border-line px-4 py-2 hover:border-leaf/40">
                Older
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
