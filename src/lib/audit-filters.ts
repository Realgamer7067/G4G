import type { Prisma } from "@/generated/prisma/client";
import { isLocalDateTime, zonedToUtc } from "./utils/timezone";

export const AUDIT_PAGE_SIZE = 50;

export type AuditFilters = {
  q: string;
  actor: string;
  action: string;
  target: string;
  from: string;
  to: string;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined, max = 100) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, max) ?? "";
const day = (v: string) => (isLocalDateTime(v) && v.length === 10 ? v : "");

export function parseAuditFilters(sp: SearchParams): AuditFilters {
  const page = Number.parseInt(first(sp.page, 6), 10);
  return {
    q: first(sp.q),
    actor: first(sp.actor, 40),
    action: first(sp.action, 60),
    target: first(sp.target, 40),
    from: day(first(sp.from, 10)),
    to: day(first(sp.to, 10)),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Next calendar day of a YYYY-MM-DD string. */
function nextDay(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Dates are whole days in the site's time zone; `to` is inclusive. */
export function buildAuditWhere(f: AuditFilters, timeZone: string): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { targetLabel: { contains: f.q, mode: "insensitive" } },
        { actorName: { contains: f.q, mode: "insensitive" } },
        { action: { contains: f.q, mode: "insensitive" } },
      ],
    });
  }
  if (f.actor) and.push({ actorId: f.actor });
  if (f.action) and.push(f.action.includes(".") ? { action: f.action } : { action: { startsWith: `${f.action}.` } });
  if (f.target) and.push({ targetType: f.target });
  if (f.from || f.to) {
    and.push({
      createdAt: {
        ...(f.from ? { gte: zonedToUtc(f.from, timeZone) } : {}),
        ...(f.to ? { lt: zonedToUtc(nextDay(f.to), timeZone) } : {}),
      },
    });
  }
  return and.length ? { AND: and } : {};
}

export function auditQueryString(f: AuditFilters, page: number): string {
  const params = new URLSearchParams();
  for (const key of ["q", "actor", "action", "target", "from", "to"] as const) if (f[key]) params.set(key, f[key]);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `?${s}` : "";
}
