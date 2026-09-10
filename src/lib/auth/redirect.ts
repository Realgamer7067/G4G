/** Only allow redirects back into the admin area, never to login or another origin. */
export function safeAdminRedirect(value: unknown): string {
  if (typeof value !== "string" || value.includes("\\")) return "/admin";
  const inAdmin = value === "/admin" || value.startsWith("/admin/") || value.startsWith("/admin?");
  if (!inAdmin || value.startsWith("/admin/login")) return "/admin";
  return value;
}
