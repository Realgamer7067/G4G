import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { contentTypeFor, resolveInside, visibilityRoot } from "@/lib/media/storage";

const NOT_FOUND = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Serves files from the PUBLIC upload tree only: /media/yyyy/mm/uuid/file.ext */
export async function GET(_req: Request, ctx: RouteContext<"/media/[...path]">) {
  const { path: parts } = await ctx.params;
  if (parts.length !== 4 || !/^\d{4}$/.test(parts[0]) || !/^\d{2}$/.test(parts[1]) || !/^[0-9a-f-]{36}$/.test(parts[2])) {
    return NOT_FOUND();
  }
  if (!/^[a-z0-9]+\.[a-z0-9]+$/.test(parts[3])) return NOT_FOUND();

  const file = resolveInside(visibilityRoot("PUBLIC"), ...parts);
  if (!file) return NOT_FOUND();

  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return NOT_FOUND();
    size = info.size;
  } catch {
    return NOT_FOUND();
  }

  const body = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
  return new Response(body, {
    headers: {
      "Content-Type": contentTypeFor(parts[3]),
      "Content-Length": String(size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-site",
    },
  });
}
