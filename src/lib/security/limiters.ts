import "server-only";
import { createRateLimiter } from "./rate-limit";

const FIFTEEN_MINUTES = 15 * 60_000;

/** Per IP + email: 5 attempts per 15 minutes. */
export const loginLimiter = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });
/** Per IP across all emails: 30 attempts per 15 minutes. */
export const loginIpLimiter = createRateLimiter({ limit: 30, windowMs: FIFTEEN_MINUTES });
/** Per IP: 10 invite acceptances per 15 minutes. */
export const inviteLimiter = createRateLimiter({ limit: 10, windowMs: FIFTEEN_MINUTES });
/** Per admin: 60 image uploads per minute. */
export const uploadLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
