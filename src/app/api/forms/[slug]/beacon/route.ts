import { db } from "@/lib/db";
import { parseRequestMeta } from "@/lib/request-meta";
import { beaconLimiter } from "@/lib/security/limiters";
import { isSameOrigin } from "@/lib/security/origin";
import { zonedDay } from "@/lib/utils/timezone";

/** Anonymous view/start counters for the form funnel. No cookies, no personal data. */
export async function POST(req: Request, ctx: RouteContext<"/api/forms/[slug]/beacon">) {
  if (!isSameOrigin(req)) return new Response(null, { status: 403 });
  const meta = parseRequestMeta(req.headers);
  if (!beaconLimiter.check(meta.ip ?? "unknown").allowed) return new Response(null, { status: 429 });

  let type: unknown;
  try {
    type = ((await req.json()) as { type?: unknown }).type;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (type !== "view" && type !== "start") return new Response(null, { status: 400 });

  const { slug } = await ctx.params;
  const form = await db.form.findUnique({ where: { slug }, select: { id: true } });
  if (!form) return new Response(null, { status: 404 });

  const date = new Date(`${zonedDay(new Date(), "UTC")}T00:00:00Z`);
  const field = type === "view" ? "views" : "starts";
  await db.formDailyStat.upsert({
    where: { formId_date: { formId: form.id, date } },
    create: { formId: form.id, date, [field]: 1 },
    update: { [field]: { increment: 1 } },
  });
  return new Response(null, { status: 204 });
}
