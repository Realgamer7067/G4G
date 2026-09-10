import type { PermissionKey } from "./permissions";

export const SUPER_ADMIN_ROLE_KEY = "super_admin";

export type RolePreset = {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: readonly PermissionKey[] | "*";
};

export const ROLE_PRESETS: readonly RolePreset[] = [
  {
    key: SUPER_ADMIN_ROLE_KEY,
    name: "Super Admin",
    description: "Full access, including admins, roles and settings. Cannot be restricted.",
    isSystem: true,
    permissions: "*",
  },
  {
    key: "event_manager",
    name: "Event Manager",
    description: "Runs events end to end: details, posters, sponsors, registration forms and responses.",
    isSystem: false,
    permissions: [
      "dashboard.view", "events.create", "events.edit", "events.delete", "events.publish",
      "sponsors.manage", "forms.create", "forms.edit", "forms.responses.view",
      "forms.responses.export", "media.upload",
    ],
  },
  {
    key: "form_manager",
    name: "Form Manager",
    description: "Builds forms and manages their responses.",
    isSystem: false,
    permissions: [
      "dashboard.view", "forms.create", "forms.edit", "forms.delete", "forms.responses.view",
      "forms.responses.export", "forms.responses.delete", "media.upload",
    ],
  },
  {
    key: "content_manager",
    name: "Content Manager",
    description: "Keeps the website fresh: homepage, pages, announcements and gallery.",
    isSystem: false,
    permissions: [
      "dashboard.view", "homepage.edit", "homepage.publish", "pages.manage",
      "announcements.manage", "gallery.manage", "media.upload",
    ],
  },
  {
    key: "team_manager",
    name: "Team Manager",
    description: "Maintains team years and member profiles.",
    isSystem: false,
    permissions: ["dashboard.view", "team.manage", "media.upload"],
  },
];
