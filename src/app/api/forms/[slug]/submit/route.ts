import { z } from "zod";
import { parseRequestMeta } from "@/lib/request-meta";
import { isSameOrigin } from "@/lib/security/origin";
import { submitFormResponse } from "@/server/forms/submit";

const MAX_BODY = 256 * 1024;

const bodySchema = z.object({
  versionId: z.string().min(1).max(64),
  answers: z.record(z.string().max(64), z.union([z.string().max(10_000), z.number(), z.array(z.string().max(500)).max(100), z.null()])),
  startedAt: z.number().int(),
  honeypot: z.string().max(500).default(""),
  event: z.string().max(80).nullish(),
});

export async function POST(req: Request, ctx: RouteContext<"/api/forms/[slug]/submit">) {
  if (!isSameOrigin(req)) return Response.json({ error: "This request came from another site and was blocked." }, { status: 403 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "That submission is too large." }, { status: 413 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "The submission couldn't be read. Reload the page and try again." }, { status: 400 });
  }

  const { slug } = await ctx.params;
  const result = await submitFormResponse({
    slug,
    eventSlug: body.event ?? null,
    versionId: body.versionId,
    answers: body.answers,
    startedAt: body.startedAt,
    honeypot: body.honeypot,
    meta: parseRequestMeta(req.headers),
  });
  if (result.ok) return Response.json({ ok: true, message: result.message });
  return Response.json({ ok: false, error: result.error, fieldErrors: result.fieldErrors }, { status: result.status });
}
