import { revalidateTag } from "next/cache";

/** Cache tags for public data. Mutations call invalidate() with every tag their change touches. */
export const TAGS = {
  site: "site-settings",
  pages: "page-settings",
  homepage: "homepage",
  events: "events",
  forms: "forms",
  sponsors: "sponsors",
  announcements: "announcements",
  team: "team",
  gallery: "gallery",
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS] | `event:${string}` | `form:${string}`;

/** Expire immediately so the admin who made the change sees it on the next request. */
export function invalidate(...tags: CacheTag[]): void {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
