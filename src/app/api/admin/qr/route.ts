import type { NextRequest } from "next/server";
import { ApiError, apiHandler, requireApiPermission } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { renderQrPng, renderQrSvg } from "@/lib/qr";

function siteBase() {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Resolves a QR target to the URL it should encode. Only known destinations: no open QR generator. */
async function resolveTarget(target: string): Promise<{ url: string; name: string }> {
  const [kind, id] = target.split(":");
  if (!id) throw new ApiError(400, "Unknown QR target.");
  if (kind === "event" || kind === "register") {
    const event = await db.event.findUnique({ where: { id }, select: { slug: true, registrationMode: true, externalRegistrationUrl: true } });
    if (!event) throw new ApiError(404, "That event no longer exists.");
    if (kind === "event") return { url: `${siteBase()}/events/${event.slug}`, name: `${event.slug}-page` };
    if (event.registrationMode === "EXTERNAL" && event.externalRegistrationUrl) {
      return { url: event.externalRegistrationUrl, name: `${event.slug}-registration` };
    }
    throw new ApiError(404, "This event has no registration link.");
  }
  throw new ApiError(400, "Unknown QR target.");
}

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiPermission(req, "events.edit");
  const params = req.nextUrl.searchParams;
  const { url, name } = await resolveTarget(params.get("target") ?? "");
  const branded = params.get("branded") === "1";
  const download = params.get("download") === "1";
  const suffix = branded ? "-branded" : "";
  const disposition = download ? `attachment; filename="${name}-qr${suffix}.${params.get("format") === "svg" ? "svg" : "png"}"` : "inline";

  if (params.get("format") === "svg") {
    return new Response(await renderQrSvg(url, branded), {
      headers: { "Content-Type": "image/svg+xml", "Content-Disposition": disposition, "Cache-Control": "private, no-store", "X-QR-URL": url },
    });
  }
  const png = await renderQrPng(url, branded);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Content-Disposition": disposition, "Cache-Control": "private, no-store", "X-QR-URL": url },
  });
});
