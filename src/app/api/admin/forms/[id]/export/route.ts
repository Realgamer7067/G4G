import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { ApiError, apiHandler, requireApiPermission } from "@/lib/auth/api";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { formDefinitionSchema } from "@/lib/forms/engine/schema";
import { buildExportTable, safeCell, toCsv, type ExportVersion } from "@/lib/forms/export";
import { buildResponseWhere, parseResponseFilters } from "@/lib/forms/response-filters";
import { parseRequestMeta } from "@/lib/request-meta";

const MAX_ROWS = 20_000;

export const GET = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/admin/forms/[id]/export">) => {
  const user = await requireApiPermission(req, "forms.responses.export");
  const { id } = await ctx.params;
  const form = await db.form.findUnique({ where: { id }, include: { versions: true } });
  if (!form) throw new ApiError(404, "That form no longer exists.");

  const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const { timezone } = await loadSiteSettings();
  const filters = parseResponseFilters(Object.fromEntries(req.nextUrl.searchParams));
  const responses = await db.formResponse.findMany({
    where: buildResponseWhere(form.id, filters, timezone),
    include: { event: { select: { title: true } }, files: { select: { id: true, originalName: true } } },
    orderBy: { submittedAt: "asc" },
    take: MAX_ROWS,
  });

  const versions: ExportVersion[] = form.versions.flatMap((v) => {
    const parsed = formDefinitionSchema.safeParse(v.definition);
    return parsed.success ? [{ id: v.id, version: v.version, definition: parsed.data }] : [];
  });
  const table = buildExportTable(
    versions,
    responses.map((r) => ({
      id: r.id,
      versionId: r.versionId,
      submittedAt: r.submittedAt,
      email: r.email,
      eventTitle: r.event?.title ?? null,
      data: r.data as Record<string, never>,
      fileNames: Object.fromEntries(r.files.map((f) => [f.id, f.originalName])),
    })),
    timezone,
  );

  await writeAuditLog(db, {
    actor: { id: user.id, name: user.name },
    action: "form.responses_exported",
    target: { type: "Form", id: form.id, label: form.name },
    metadata: { format, rows: table.rows.length, filtered: Boolean(filters.q || filters.from || filters.to || filters.event) },
    meta: parseRequestMeta(req.headers),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${form.slug}-responses-${stamp}.${format}`;
  const headers = { "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

  if (format === "csv") return new Response(toCsv(table), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" } });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GFG Student Chapter";
  const sheet = workbook.addWorksheet("Responses", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(table.headers.map(safeCell)).font = { bold: true };
  for (const row of table.rows) sheet.addRow(row.map(safeCell));
  sheet.columns.forEach((col, i) => {
    col.width = Math.min(48, Math.max(12, table.headers[i]?.length ?? 12, ...table.rows.slice(0, 200).map((r) => (r[i] ?? "").length)));
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  });
});
