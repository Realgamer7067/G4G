import { db } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { allFields } from "@/lib/forms/engine/schema";
import { parseRequestMeta } from "@/lib/request-meta";
import { formUploadLimiter } from "@/lib/security/limiters";
import { isSameOrigin } from "@/lib/security/origin";
import { parseDefinition } from "@/server/forms/definition";
import { saveFormFile } from "@/server/forms/files";

const HARD_LIMIT = 10 * 1024 * 1024;

/** Public: a respondent uploads a file for a file question. It stays private and unattached until submit. */
export async function POST(req: Request, ctx: RouteContext<"/api/forms/[slug]/upload">) {
  if (!isSameOrigin(req)) return Response.json({ error: "This request came from another site and was blocked." }, { status: 403 });
  const meta = parseRequestMeta(req.headers);
  if (!formUploadLimiter.check(meta.ip ?? "unknown").allowed) {
    return Response.json({ error: "Too many uploads from your network. Try again in a minute." }, { status: 429 });
  }
  if (Number(req.headers.get("content-length") ?? 0) > HARD_LIMIT + 64 * 1024) {
    return Response.json({ error: "Files must be 10 MB or smaller." }, { status: 413 });
  }

  const { slug } = await ctx.params;
  const form = await db.form.findUnique({ where: { slug }, include: { publishedVersion: true } });
  if (!form?.publishedVersion || !form.acceptingResponses) return Response.json({ error: "This form isn't accepting uploads." }, { status: 404 });

  const data = await req.formData();
  const file = data.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  const fieldId = String(data.get("fieldId") ?? "");
  const field = allFields(parseDefinition(form.publishedVersion.definition)).find((f) => f.id === fieldId && f.type === "file");
  if (!field) return Response.json({ error: "This question doesn't accept files." }, { status: 400 });

  const maxBytes = Math.min(field.validation?.maxFileMb ?? 5, 10) * 1024 * 1024;
  try {
    const upload = await saveFormFile({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      allowed: field.validation?.fileTypes?.length ? field.validation.fileTypes : ["pdf", "image", "doc"],
      maxBytes,
    });
    return Response.json({ id: upload.id, name: upload.originalName, size: upload.sizeBytes }, { status: 201 });
  } catch (error) {
    if (error instanceof UserError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
