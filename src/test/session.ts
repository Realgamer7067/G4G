import { createSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { createAdmin } from "./factories";
import { mockRequest } from "./mocks/state";

/** Creates an admin, opens a session and puts its token in the mocked cookie jar. */
export async function signIn(opts: { permissions?: PermissionKey[]; roleKey?: string } = {}) {
  const admin = await createAdmin(opts);
  const session = await createSession(admin.id, { ip: "127.0.0.1", userAgent: "vitest" });
  mockRequest.token = session.token;
  return { admin, session };
}

export function formOf(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) fd.append(key, v);
  }
  return fd;
}
