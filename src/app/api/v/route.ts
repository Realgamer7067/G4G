import { isLikelyBot, normalizePagePath } from "@/lib/analytics/page-view";
import { getSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { parseRequestMeta } from "@/lib/request-meta";
import { pageViewLimiter } from "@/lib/security/limiters";
import { isSameOrigin } from "@/lib/security/origin";
import { zonedDay } from "@/lib/utils/timezone";

/** Anonymous page-view counter. No cookies, no IP or user-agent stored — only (day, path) → count. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response(null, { status: 403 });
  const meta = parseRequestMeta(req.headers);
  if (isLikelyBot(meta.userAgent)) return new Response(null, { status: 204 });
  if (!pageViewLimiter.check(meta.ip ?? "unknown").allowed) return new Response(null, { status: 429 });

  let raw: unknown;
  try {
    raw = ((await req.json()) as { path?: unknown }).path;
  } catch {
    return new Response(null, { status: 400 });
  }
  const path = normalizePagePath(raw);
  if (!path) return new Response(null, { status: 400 });

  const { timezone } = await getSiteSettings();
  const date = new Date(`${zonedDay(new Date(), timezone)}T00:00:00Z`);
  await db.dailyPageView.upsert({
    where: { date_path: { date, path } },
    create: { date, path, views: 1 },
    update: { views: { increment: 1 } },
  });
  return new Response(null, { status: 204 });
}
