import { CalendarDays, ClipboardList, FileStack, Handshake, Home, LayoutDashboard, Megaphone, ScrollText, Settings, ShieldCheck, Users, UsersRound, type LucideIcon } from "lucide-react";
import type { PermissionKey } from "@/lib/rbac/permissions";

export type AdminNavSection = "Overview" | "Content" | "Website" | "Administration";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon; permission: PermissionKey; section: AdminNavSection };

export const ADMIN_NAV_SECTIONS: readonly AdminNavSection[] = ["Overview", "Content", "Website", "Administration"];

/** Only list screens that exist. Later phases append here. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view", section: "Overview" },
  { href: "/admin/events", label: "Events", icon: CalendarDays, permission: "events.edit", section: "Content" },
  { href: "/admin/forms", label: "Forms", icon: ClipboardList, permission: "forms.responses.view", section: "Content" },
  { href: "/admin/sponsors", label: "Sponsors", icon: Handshake, permission: "sponsors.manage", section: "Content" },
  { href: "/admin/team", label: "Team", icon: UsersRound, permission: "team.manage", section: "Content" },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, permission: "announcements.manage", section: "Content" },
  { href: "/admin/homepage", label: "Homepage", icon: Home, permission: "homepage.edit", section: "Website" },
  { href: "/admin/pages", label: "Pages & menu", icon: FileStack, permission: "pages.manage", section: "Website" },
  { href: "/admin/settings", label: "Site settings", icon: Settings, permission: "settings.manage", section: "Website" },
  { href: "/admin/users", label: "Admins", icon: Users, permission: "admins.manage", section: "Administration" },
  { href: "/admin/roles", label: "Roles", icon: ShieldCheck, permission: "roles.manage", section: "Administration" },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, permission: "logs.view", section: "Administration" },
];
