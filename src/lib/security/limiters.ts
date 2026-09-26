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
/** Per IP: 10 form submissions per minute. */
export const formSubmitLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
/** Per IP: 20 form file uploads per minute. */
export const formUploadLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
/** Per IP: 60 analytics beacons per minute. */
export const beaconLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
/** Per IP: 120 page-view beacons per minute (a few per page load, with generous headroom for fast navigation). */
export const pageViewLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
