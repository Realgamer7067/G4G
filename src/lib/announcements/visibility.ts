// src/lib/announcements/visibility.ts

export type AnnouncementVisibilityInput = {
  status: "DRAFT" | "PUBLISHED";
  publishAt: Date;
  expiresAt: Date | null;
};

/** PUBLISHED ∧ publishAt ≤ now ∧ (expiresAt null ∨ now < expiresAt). */
export function isAnnouncementVisible(a: AnnouncementVisibilityInput, now: Date): boolean {
  return a.status === "PUBLISHED" && a.publishAt <= now && (a.expiresAt === null || now < a.expiresAt);
}

export type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "URGENT";

/** The only fields the client banner receives; keep narrow so page bodies never ride along in the RSC payload. */
export type BannerAnnouncement = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  priority: AnnouncementPriority;
  linkUrl: string | null;
  linkLabel: string | null;
  updatedAt: string;
};

export type AnnouncementAdminStatus = "Draft" | "Published" | "Scheduled" | "Expired";

/** Admin-facing label: Published only while the announcement is actually visible on the site. */
export function announcementAdminStatus(a: AnnouncementVisibilityInput, now: Date): AnnouncementAdminStatus {
  if (a.status === "DRAFT") return "Draft";
  if (isAnnouncementVisible(a, now)) return "Published";
  return a.publishAt > now ? "Scheduled" : "Expired";
}

export type BannerCandidate = AnnouncementVisibilityInput & {
  id: string;
  priority: AnnouncementPriority;
  showAsBanner: boolean;
  updatedAt: Date;
};

const PRIORITY_RANK: Record<AnnouncementPriority, number> = {
  URGENT: 3,
  IMPORTANT: 2,
  NORMAL: 1,
};

/** Highest-priority visible banner announcement; ties broken by the most recently published. */
export function selectBannerAnnouncement<T extends BannerCandidate>(rows: readonly T[], now: Date): T | null {
  const eligible = rows.filter((a) => a.showAsBanner && isAnnouncementVisible(a, now));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, a) =>
    PRIORITY_RANK[a.priority] > PRIORITY_RANK[best.priority] || (PRIORITY_RANK[a.priority] === PRIORITY_RANK[best.priority] && a.publishAt > best.publishAt) ? a : best,
  );
}

/** Client-side dismiss key: id + updatedAt, so editing a dismissed announcement re-shows the banner. */
export function dismissalKey(a: { id: string; updatedAt: Date | string }): string {
  const iso = typeof a.updatedAt === "string" ? a.updatedAt : a.updatedAt.toISOString();
  return `${a.id}:${iso}`;
}
