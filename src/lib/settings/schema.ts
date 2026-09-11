import { z } from "zod";

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`);

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Links admins can type: site paths, in-page anchors, http(s) URLs and mailto. */
export const hrefSchema = z
  .string()
  .trim()
  .min(1, "Add a link.")
  .max(500)
  .refine(
    (v) => /^\/(?!\/)/.test(v) || /^#[\w-]+$/.test(v) || /^mailto:[^\s@]+@[^\s@]+$/.test(v) || isHttpUrl(v),
    "Use a link that starts with /, #, https:// or mailto:.",
  );

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || isHttpUrl(v), "Use a full link that starts with https://.")
  .default("");

export const SOCIAL_NETWORKS = ["instagram", "linkedin", "github", "youtube", "discord", "whatsapp", "x"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const socialsSchema = z.object({
  instagram: optionalUrl,
  linkedin: optionalUrl,
  github: optionalUrl,
  youtube: optionalUrl,
  discord: optionalUrl,
  whatsapp: optionalUrl,
  x: optionalUrl,
  custom: z
    .array(z.object({ label: text(40).min(1, "Add a label."), url: z.string().trim().refine(isHttpUrl, "Use a full link.") }))
    .max(6)
    .default([]),
});
export type Socials = z.infer<typeof socialsSchema>;

export const footerSchema = z.object({
  blurb: text(300).default(""),
  copyright: text(120).default(""),
  columns: z
    .array(
      z.object({
        title: text(40).min(1, "Add a column title."),
        links: z.array(z.object({ label: text(40).min(1, "Add a label."), href: hrefSchema })).max(8),
      }),
    )
    .max(4, "Use at most four columns.")
    .default([]),
});
export type FooterSettings = z.infer<typeof footerSchema>;

export const seoSchema = z.object({
  titleTemplate: text(80)
    .refine((v) => v.includes("%s"), "Include %s where the page title goes.")
    .default("%s · GfG Student Chapter"),
  defaultDescription: text(200).default(""),
  ogImageId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null),
});
export type SeoSettings = z.infer<typeof seoSchema>;

export const navCtaSchema = z
  .object({ label: text(30).default(""), href: z.string().trim().default("") })
  .superRefine((v, ctx) => {
    if (!v.label && !v.href) return;
    if (!v.label) ctx.addIssue({ code: "custom", path: ["label"], message: "Add a button label." });
    const href = hrefSchema.safeParse(v.href);
    if (!href.success) ctx.addIssue({ code: "custom", path: ["href"], message: href.error.issues[0]?.message ?? "Add a link." });
  })
  .transform((v) => (v.label ? { label: v.label, href: v.href } : null));
export type NavCta = { label: string; href: string };

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const siteSettingsFormSchema = z.object({
  clubName: text(100).min(1, "Enter the club name."),
  shortName: text(40).min(1, "Enter a short name."),
  tagline: text(140).default(""),
  description: text(600).default(""),
  universityName: text(120).default(""),
  email: text(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.")
    .default(""),
  phone: text(40).default(""),
  address: text(300).default(""),
  mapUrl: optionalUrl,
  timezone: z.string().trim().refine(isTimeZone, "Pick a valid time zone.").default("Asia/Kolkata"),
  logoId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null),
  socials: socialsSchema.prefault({}),
  footer: footerSchema.prefault({}),
  seo: seoSchema.prefault({}),
  navCta: navCtaSchema.prefault({}),
});
export type SiteSettingsForm = z.infer<typeof siteSettingsFormSchema>;
