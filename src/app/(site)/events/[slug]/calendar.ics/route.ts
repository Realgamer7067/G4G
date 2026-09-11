import { richTextToPlain } from "@/lib/content/sanitize";
import { getPublicEvent } from "@/lib/data/events";
import { getPageSetting } from "@/lib/data/pages";
import { buildIcs } from "@/lib/events/ics";
import { isPageLive } from "@/lib/pages/registry";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/events/[slug]/calendar.ics">) {
  const { slug } = await ctx.params;
  const [page, event] = await Promise.all([getPageSetting("EVENTS"), getPublicEvent(slug)]);
  if (!isPageLive(page) || !event || event.lifecycle !== "PUBLISHED") return new Response("Not found", { status: 404 });

  const url = absoluteUrl(`/events/${event.slug}`);
  const ics = buildIcs({
    uid: event.id,
    title: event.title,
    description: `${event.tagline ? `${event.tagline}\n\n` : ""}${richTextToPlain(event.description, 1500)}\n\n${url}`,
    startAt: new Date(event.startAt),
    endAt: new Date(event.endAt),
    location: event.mode === "ONLINE" ? (event.onlineUrl ?? "Online") : event.venue,
    url,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
