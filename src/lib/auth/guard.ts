import "server-only";
import { forbidden, redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { getSession, type SessionUser } from "./session";

export function can(user: Pick<SessionUser, "permissions">, key: PermissionKey): boolean {
  return user.permissions.has(key);
}

/** Pages/layouts: redirect to sign-in when there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/admin/login");
  return user;
}

/** Pages: sign-in redirect, then the 403 view when the permission is missing. */
export async function requirePagePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, key)) forbidden();
  return user;
}

/** Pages shared by several roles: allowed when the user has at least one of the permissions. */
export async function requireAnyPagePermission(keys: readonly PermissionKey[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!keys.some((k) => can(user, k))) forbidden();
  return user;
}

/** Server Actions and route handlers: throw typed errors that runAction() turns into messages. */
export async function requireActionUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requirePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await requireActionUser();
  if (!can(user, key)) throw new ForbiddenError();
  return user;
}
