import "server-only";
import { createRateLimiter } from "./rate-limit";

const FIFTEEN_MINUTES = 15 * 60_000;

/** Per IP + email: 5 attempts per 15 minutes. */
export const loginLimiter = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });
/** Per IP across all emails: 30 attempts per 15 minutes. */
export const loginIpLimiter = createRateLimiter({ limit: 30, windowMs: FIFTEEN_MINUTES });
