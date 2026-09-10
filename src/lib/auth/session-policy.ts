const DAY = 86_400_000;
export const SESSION_IDLE_MS = 7 * DAY;
export const SESSION_ABSOLUTE_MS = 30 * DAY;
export const SESSION_TOUCH_MS = DAY;

export function evaluateSession(
  s: { createdAt: Date; expiresAt: Date; lastSeenAt: Date },
  userActive: boolean,
  now: Date,
): { valid: false } | { valid: true; touch: boolean; newExpiresAt: Date } {
  const hardLimit = s.createdAt.getTime() + SESSION_ABSOLUTE_MS;
  if (!userActive || now.getTime() >= s.expiresAt.getTime() || now.getTime() >= hardLimit) return { valid: false };
  const touch = now.getTime() - s.lastSeenAt.getTime() > SESSION_TOUCH_MS;
  const newExpiresAt = new Date(Math.min(now.getTime() + SESSION_IDLE_MS, hardLimit));
  return { valid: true, touch, newExpiresAt };
}
