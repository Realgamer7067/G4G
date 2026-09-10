import { headers } from "next/headers";

export type RequestMeta = { ip: string | null; userAgent: string | null };

/** nginx sets X-Real-IP in production; X-Forwarded-For is the fallback. */
export function parseRequestMeta(h: Headers): RequestMeta {
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 512) ?? null;
  return { ip, userAgent };
}

export async function getRequestMeta(): Promise<RequestMeta> {
  return parseRequestMeta(await headers());
}
