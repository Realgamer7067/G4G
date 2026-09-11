/**
 * Route handlers don't get Server Actions' built-in origin check, so mutating handlers call this.
 * Accepts the request's own origin, plus SITE_URL's origin for deployments behind a proxy.
 */
export function isSameOrigin(req: Request, siteUrl: string | undefined = process.env.SITE_URL): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([new URL(req.url).origin]);
  if (siteUrl) {
    try {
      allowed.add(new URL(siteUrl).origin);
    } catch {
      // ignore a malformed SITE_URL; the request origin still applies
    }
  }
  return allowed.has(origin);
}
