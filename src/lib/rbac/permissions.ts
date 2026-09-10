export const PERMISSIONS = [
  { key: "dashboard.view", group: "General", description: "Open the admin dashboard" },
  { key: "events.create", group: "Events", description: "Create events and duplicate existing ones" },
  { key: "events.edit", group: "Events", description: "Edit event details, posters and event sponsors" },
  { key: "events.delete", group: "Events", description: "Permanently delete events" },
  { key: "events.publish", group: "Events", description: "Publish, unpublish, cancel and archive events" },
  { key: "forms.create", group: "Forms", description: "Create forms" },
  { key: "forms.edit", group: "Forms", description: "Edit and publish forms and change form settings" },
  { key: "forms.delete", group: "Forms", description: "Delete forms together with their responses" },
  { key: "forms.responses.view", group: "Forms", description: "View form responses and uploaded files" },
  { key: "forms.responses.export", group: "Forms", description: "Download responses as CSV or Excel" },
  { key: "forms.responses.delete", group: "Forms", description: "Delete form responses" },
  { key: "homepage.edit", group: "Website", description: "Edit homepage sections as a draft" },
  { key: "homepage.publish", group: "Website", description: "Publish the homepage draft to the live site" },
  { key: "pages.manage", group: "Website", description: "Turn pages on or off, edit About and Contact, change navigation" },
  { key: "announcements.manage", group: "Content", description: "Create, edit and remove announcements" },
  { key: "team.manage", group: "Content", description: "Manage team years and members" },
  { key: "gallery.manage", group: "Content", description: "Manage gallery albums and photos" },
  { key: "sponsors.manage", group: "Content", description: "Manage sponsors and partners" },
  { key: "media.upload", group: "Content", description: "Upload images and files" },
  { key: "admins.manage", group: "Administration", description: "Invite, deactivate and edit admins and their permissions" },
  { key: "roles.manage", group: "Administration", description: "Create and edit roles" },
  { key: "settings.manage", group: "Administration", description: "Edit club details, social links, footer and SEO defaults" },
  { key: "logs.view", group: "Administration", description: "View the audit log" },
] as const satisfies readonly { key: string; group: string; description: string }[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map((p) => p.key);

const KEY_SET: ReadonlySet<string> = new Set(ALL_PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return KEY_SET.has(value);
}

export const PERMISSION_GROUPS: readonly string[] = [...new Set(PERMISSIONS.map((p) => p.group))];
