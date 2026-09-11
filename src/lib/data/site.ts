import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { publicImageSelect, toPublicImage, type PublicImage } from "@/lib/media/public-image";
import {
  footerSchema,
  navCtaSchema,
  seoSchema,
  socialsSchema,
  type FooterSettings,
  type NavCta,
  type SeoSettings,
  type Socials,
} from "@/lib/settings/schema";
import { SITE_DEFAULTS } from "@/server/seed/defaults";

export type SiteSettingsDTO = {
  clubName: string;
  shortName: string;
  tagline: string;
  description: string;
  universityName: string;
  email: string;
  phone: string;
  address: string;
  mapUrl: string;
  timezone: string;
  logo: PublicImage | null;
  socials: Socials;
  footer: FooterSettings;
  seo: SeoSettings & { ogImage: PublicImage | null };
  navCta: NavCta | null;
};

function parseOr<T>(schema: { safeParse(v: unknown): { success: boolean; data?: T } }, value: unknown, fallback: unknown): T {
  const parsed = schema.safeParse(value);
  return (parsed.success ? parsed.data : schema.safeParse(fallback).data) as T;
}

export async function loadSiteSettings(): Promise<SiteSettingsDTO> {
  const row = await db.siteSettings.findUnique({ where: { id: 1 }, include: { logo: { select: publicImageSelect } } });
  const base = row ?? { ...SITE_DEFAULTS, phone: "", address: "", mapUrl: "", navCtas: [], logo: null };
  const seo = parseOr<SeoSettings>(seoSchema, base.seo, {});
  const ogUpload = seo.ogImageId
    ? await db.upload.findUnique({ where: { id: seo.ogImageId }, select: publicImageSelect })
    : null;
  const ctas = Array.isArray(base.navCtas) ? base.navCtas : [];

  return {
    clubName: base.clubName,
    shortName: base.shortName,
    tagline: base.tagline,
    description: base.description,
    universityName: base.universityName,
    email: base.email,
    phone: base.phone,
    address: base.address,
    mapUrl: base.mapUrl,
    timezone: base.timezone,
    logo: toPublicImage(base.logo),
    socials: parseOr<Socials>(socialsSchema, base.socials, {}),
    footer: parseOr<FooterSettings>(footerSchema, base.footer, {}),
    seo: { ...seo, ogImage: toPublicImage(ogUpload) },
    navCta: ctas.length ? (navCtaSchema.safeParse(ctas[0]).data ?? null) : null,
  };
}

/** Cached for public pages; invalidated with TAGS.site. */
export const getSiteSettings = unstable_cache(loadSiteSettings, ["site-settings"], { tags: [TAGS.site] });
