import "server-only";
import type { Metadata } from "next";
import type { PageKey } from "@/generated/prisma/enums";
import { getPageSetting } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { ogImage } from "@/lib/media/public-image";
import { PAGE_ROUTES } from "@/lib/pages/registry";

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Metadata for a toggleable page: admin-set SEO text first, then the page's own defaults. */
export async function metadataForPage(key: PageKey, defaults: { title: string; description: string }): Promise<Metadata> {
  const [page, site] = await Promise.all([getPageSetting(key), getSiteSettings()]);
  const description = page?.seoDescription || defaults.description || site.seo.defaultDescription;
  const og = site.seo.ogImage ? ogImage(site.seo.ogImage) : null;
  return {
    title: page?.seoTitle || defaults.title,
    description,
    alternates: { canonical: PAGE_ROUTES[key] },
    openGraph: { title: page?.seoTitle || defaults.title, description, url: PAGE_ROUTES[key], images: og ? [og] : undefined },
  };
}
