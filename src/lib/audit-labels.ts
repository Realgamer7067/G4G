/** Plain-language names for audit actions. Unknown actions fall back to their code. */
const LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.logout": "Signed out",
  "account.profile_updated": "Changed their name",
  "account.password_changed": "Changed their password",
  "account.session_revoked": "Signed out a device",
  "account.sessions_revoked": "Signed out all other devices",
  "admin.invited": "Invited an admin",
  "admin.invite_revoked": "Revoked an invite",
  "admin.invite_accepted": "Accepted an invite",
  "admin.role_changed": "Changed an admin's role",
  "admin.activated": "Reactivated an admin",
  "admin.deactivated": "Deactivated an admin",
  "admin.permissions_changed": "Changed an admin's permissions",
  "role.created": "Created a role",
  "role.updated": "Updated a role",
  "role.deleted": "Deleted a role",
  "settings.updated": "Updated site settings",
  "pages.updated": "Updated pages & menu",
  "media.uploaded": "Uploaded an image",
  "event.created": "Created an event",
  "event.updated": "Edited an event",
  "event.duplicated": "Duplicated an event",
  "event.published": "Published an event",
  "event.unpublished": "Unpublished an event",
  "event.cancelled": "Cancelled an event",
  "event.reinstated": "Reinstated an event",
  "event.archived": "Archived an event",
  "event.restored": "Restored an event",
  "event.deleted": "Deleted an event",
  "sponsor.created": "Added a sponsor",
  "sponsor.updated": "Edited a sponsor",
  "sponsor.deleted": "Removed a sponsor",
  "category.created": "Added an event category",
  "category.updated": "Renamed an event category",
  "category.deleted": "Deleted an event category",
};

export const AUDIT_ACTION_FAMILIES: { value: string; label: string }[] = [
  { value: "auth", label: "Sign-ins" },
  { value: "account", label: "Own account" },
  { value: "admin", label: "Admins & invites" },
  { value: "role", label: "Roles" },
  { value: "settings", label: "Site settings" },
  { value: "pages", label: "Pages & menu" },
  { value: "media", label: "Uploads" },
  { value: "event", label: "Events" },
  { value: "sponsor", label: "Sponsors" },
  { value: "category", label: "Event categories" },
];

export function registerAuditLabels(labels: Record<string, string>, families: { value: string; label: string }[] = []): void {
  Object.assign(LABELS, labels);
  for (const f of families) if (!AUDIT_ACTION_FAMILIES.some((x) => x.value === f.value)) AUDIT_ACTION_FAMILIES.push(f);
}

export function describeAction(action: string): string {
  return LABELS[action] ?? action;
}
