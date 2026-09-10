import { LayoutDashboard, type LucideIcon } from "lucide-react";
import type { PermissionKey } from "@/lib/rbac/permissions";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon; permission: PermissionKey };

/** Only list screens that exist. Later phases append here. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
];
