import type { Prisma } from "@/generated/prisma/client";
import { isLocalDateTime, zonedToUtc } from "@/lib/utils/timezone";

export const RESPONSES_PAGE_SIZE = 25;

export type ResponseFilters = { q: string; from: string; to: string; event: string; page: number };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined, max = 100) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, max) ?? "";
const day = (v: string) => (isLocalDateTime(v) && v.length === 10 ? v : "");

export function parseResponseFilters(sp: SearchParams): ResponseFilters {
  const page = Number.parseInt(first(sp.page, 6), 10);
  return { q: first(sp.q), from: day(first(sp.from, 10)), to: day(first(sp.to, 10)), event: first(sp.event, 40), page: Number.isFinite(page) && page > 0 ? page : 1 };
}

function nextDay(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildResponseWhere(formId: string, f: ResponseFilters, timeZone: string): Prisma.FormResponseWhereInput {
  const and: Prisma.FormResponseWhereInput[] = [{ formId }];
  if (f.q) and.push({ searchText: { contains: f.q.toLowerCase() } });
  if (f.event) and.push({ eventId: f.event });
  if (f.from || f.to) {
    and.push({
      submittedAt: {
        ...(f.from ? { gte: zonedToUtc(f.from, timeZone) } : {}),
        ...(f.to ? { lt: zonedToUtc(nextDay(f.to), timeZone) } : {}),
      },
    });
  }
  return { AND: and };
}

export function responsesQuery(f: ResponseFilters, page: number = f.page): string {
  const p = new URLSearchParams();
  for (const k of ["q", "from", "to", "event"] as const) if (f[k]) p.set(k, f[k]);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return s ? `?${s}` : "";
}
