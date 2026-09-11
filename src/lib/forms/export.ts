import { formatAnswer } from "./engine/display";
import { allFields, type Answers, type Field, type FormDefinition } from "./engine/schema";

export type ExportVersion = { id: string; version: number; definition: FormDefinition };
export type ExportResponse = {
  id: string;
  versionId: string;
  submittedAt: Date;
  email: string | null;
  eventTitle?: string | null;
  data: Answers;
  fileNames?: Record<string, string>;
};
export type ExportTable = { headers: string[]; rows: string[][] };

function stamp(date: Date, timeZone: string): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * One column per question across every version: the latest version's order and labels first, then
 * questions that only exist in older versions. Each answer is formatted with the version it was given in.
 */
export function buildExportTable(versions: ExportVersion[], responses: ExportResponse[], timeZone: string): ExportTable {
  const newestFirst = [...versions].sort((a, b) => b.version - a.version);
  const columns: Field[] = [];
  const seen = new Set<string>();
  for (const v of newestFirst) {
    for (const f of allFields(v.definition)) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      columns.push(f);
    }
  }
  const fieldsByVersion = new Map(versions.map((v) => [v.id, new Map(allFields(v.definition).map((f) => [f.id, f]))]));
  const withEvent = responses.some((r) => r.eventTitle);

  const headers = ["Submitted at", "Email", ...(withEvent ? ["Event"] : []), ...columns.map((c) => c.label)];
  const rows = responses.map((r) => {
    const own = fieldsByVersion.get(r.versionId);
    return [
      stamp(r.submittedAt, timeZone),
      r.email ?? "",
      ...(withEvent ? [r.eventTitle ?? ""] : []),
      ...columns.map((c) => formatAnswer(own?.get(c.id) ?? c, r.data[c.id], r.fileNames)),
    ];
  });
  return { headers, rows };
}

/** Spreadsheet formula injection guard (OWASP): cells that could start a formula get a leading apostrophe. */
export function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const v = safeCell(value);
  return /[",\r\n]/.test(v) || v !== v.trim() ? `"${v.replace(/"/g, '""')}"` : v;
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel reads non-ASCII names correctly. */
export function toCsv(table: ExportTable): string {
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
