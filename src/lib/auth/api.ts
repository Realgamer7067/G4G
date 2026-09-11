import "server-only";
import { UserError } from "@/lib/errors";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { isSameOrigin } from "@/lib/security/origin";
import { can } from "./guard";
import { getSession, type SessionUser } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Session + permission + same-origin (for anything but GET/HEAD) for admin route handlers. */
export async function requireApiPermission(req: Request, key: PermissionKey): Promise<SessionUser> {
  if (req.method !== "GET" && req.method !== "HEAD" && !isSameOrigin(req)) {
    throw new ApiError(403, "This request came from another site and was blocked.");
  }
  const user = await getSession();
  if (!user) throw new ApiError(401, "Your session has ended. Sign in again.");
  if (!can(user, key)) throw new ApiError(403, "You don't have permission to do that.");
  return user;
}

/** Turns thrown ApiError/UserError into JSON responses; hides unexpected errors. */
export function apiHandler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
      if (error instanceof UserError) {
        return Response.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: 400 });
      }
      console.error(error);
      return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}
