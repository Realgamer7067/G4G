export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

/** Sliding-window log limiter. Process-local: correct for the single-process VPS deployment. */
export function createRateLimiter(opts: { limit: number; windowMs: number; maxKeys?: number }) {
  const { limit, windowMs, maxKeys = 10_000 } = opts;
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now: number = Date.now()): RateLimitResult {
      const log = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
      hits.delete(key); // re-insert below so Map order tracks recency
      if (log.length >= limit) {
        hits.set(key, log);
        return { allowed: false, remaining: 0, retryAfterMs: log[0] + windowMs - now };
      }
      log.push(now);
      hits.set(key, log);
      if (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      return { allowed: true, remaining: limit - log.length, retryAfterMs: 0 };
    },
    reset(key: string): void {
      hits.delete(key);
    },
  };
}
