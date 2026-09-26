/** First path segments that belong to public pages. Anything else (admin, api, media, assets) is never counted. */
const PUBLIC_ROOTS = new Set(["", "about", "events", "team", "gallery", "announcements", "sponsors", "contact", "forms"]);
const SEGMENT = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MAX_DEPTH = 3;

/**
 * Normalizes a reported page path into the key stored in `DailyPageView`, or `null` when it must not be counted.
 * Strict on purpose: the beacon is public, so only short, slug-shaped paths under known public roots are accepted,
 * which caps how many distinct rows a caller can create.
 */
export function normalizePagePath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 300 || !raw.startsWith("/")) return null;
  const path = raw.split(/[?#]/)[0].toLowerCase();
  const segments = path.split("/").filter(Boolean);
  if (segments.length > MAX_DEPTH) return null;
  if (!PUBLIC_ROOTS.has(segments[0] ?? "")) return null;
  if (segments.some((s) => !SEGMENT.test(s))) return null;
  return segments.length ? `/${segments.join("/")}` : "/";
}

const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|headless|lighthouse|pagespeed|monitor|curl|wget|python|httpclient|axios|node-fetch|go-http|java\//i;

/** Cheap user-agent screen. Missing UA counts as a bot. */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}
