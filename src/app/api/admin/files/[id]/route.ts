import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { ApiError, apiHandler, requireApiPermission } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { privateFilePath } from "@/server/forms/files";

/** Private respondent uploads, only for admins who can view responses. Always downloaded, never rendered inline. */
export const GET = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/admin/files/[id]">) => {
  await requireApiPermission(req, "forms.responses.view");
  const { id } = await ctx.params;
  const upload = await db.upload.findUnique({ where: { id } });
  if (!upload || upload.visibility !== "PRIVATE" || upload.purpose !== "FORM_FILE") throw new ApiError(404, "File not found.");
  const file = privateFilePath(upload);
  if (!file) throw new ApiError(404, "File not found.");
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    throw new ApiError(404, "File not found.");
  }
  const name = upload.originalName.replace(/["\\\r\n]/g, "_");
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": upload.mimeType,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
