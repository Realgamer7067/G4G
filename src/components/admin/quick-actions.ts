import { CalendarPlus, ClipboardPlus, FileStack, Handshake, Settings, ShieldPlus, UserPlus, type LucideIcon } from "lucide-react";
import type { PermissionKey } from "@/lib/rbac/permissions";

export type QuickAction = { href: string; label: string; description: string; icon: LucideIcon; permission: PermissionKey };

/** Dashboard shortcuts. Only screens that exist; later phases prepend event, form, announcement, team and gallery actions. */
export const QUICK_ACTIONS: QuickAction[] = [
  { href: "/admin/events/new", label: "Create event", description: "Start a draft with poster and details", icon: CalendarPlus, permission: "events.create" },
  { href: "/admin/forms/new", label: "Create form", description: "Multi-page form with logic", icon: ClipboardPlus, permission: "forms.create" },
  { href: "/admin/sponsors/new", label: "Add sponsor", description: "Logo, link and partner type", icon: Handshake, permission: "sponsors.manage" },
  { href: "/admin/users", label: "Invite an admin", description: "Send a single-use invite link", icon: UserPlus, permission: "admins.manage" },
  { href: "/admin/pages", label: "Pages & menu", description: "Turn pages on or off", icon: FileStack, permission: "pages.manage" },
  { href: "/admin/settings", label: "Site settings", description: "Club details, socials, footer", icon: Settings, permission: "settings.manage" },
  { href: "/admin/roles/new", label: "New role", description: "Bundle permissions for a team", icon: ShieldPlus, permission: "roles.manage" },
];
