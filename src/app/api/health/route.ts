import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database reachability for the container healthcheck. Reveals nothing beyond up/down. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
