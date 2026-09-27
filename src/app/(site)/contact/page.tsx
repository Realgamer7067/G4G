import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { PageIntro } from "@/components/site/page-intro";
import { SocialIcon, socialLinks } from "@/components/site/social-icons";
import { assertPageEnabled } from "@/lib/data/pages";
import { getSiteSettings } from "@/lib/data/site";
import { CONTACT_DEFAULTS, contactContentSchema } from "@/lib/pages/contact-schema";
import { metadataForPage } from "@/lib/seo";

export async function generateMetadata() {
  return metadataForPage("CONTACT", { title: "Contact us", description: "Get in touch." });
}

export default async function ContactPage() {
  const [page, site] = await Promise.all([assertPageEnabled("CONTACT"), getSiteSettings()]);
  const parsed = contactContentSchema.safeParse(page.content);
  const content = parsed.success ? parsed.data : CONTACT_DEFAULTS;

  const items = [
    content.showEmail && site.email && { icon: Mail, label: "Email", value: site.email, href: `mailto:${site.email}` },
    content.showPhone && site.phone && { icon: Phone, label: "Phone", value: site.phone, href: `tel:${site.phone.replace(/\s+/g, "")}` },
    content.showAddress && site.address && { icon: MapPin, label: "Find us", value: site.address, href: content.showMap && site.mapUrl ? site.mapUrl : null },
  ].filter((x): x is { icon: typeof Mail; label: string; value: string; href: string | null } => Boolean(x));
  const socials = socialLinks(site.socials);

  return (
    <div className="pb-24">
      <PageIntro layout="narrow" eyebrow={page.navLabel} title="Say hello." lead={content.intro || undefined} />
      <div className="container-x grid max-w-4xl gap-10">
        {items.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map(({ icon: Icon, label, value, href }) => {
              const body = (
                <>
                  <span className="grid size-11 place-items-center rounded-2xl bg-leaf/10 text-leaf">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="grid min-w-0 gap-1">
                    <span className="text-sm text-muted">{label}</span>
                    <span className="break-words font-display text-lg font-bold">{value}</span>
                  </span>
                  {href && <ArrowUpRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-leaf" />}
                </>
              );
              const cls = "group flex h-full items-start gap-4 rounded-[24px] border border-line bg-surface p-6 transition-colors duration-200";
              return (
                <li key={label}>
                  {href ? (
                    <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`${cls} hover:border-leaf/40`}>
                      {body}
                    </a>
                  ) : (
                    <div className={cls}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          socials.length === 0 && <p className="rounded-3xl border border-dashed border-line px-6 py-16 text-center text-muted">Contact details will be posted here soon.</p>
        )}
        {socials.length > 0 && (
          <div className="grid gap-4 border-t border-line pt-8">
            <h2 className="font-display text-xl font-bold">Follow along</h2>
            <ul className="flex flex-wrap gap-3">
              {socials.map((link) => (
                <li key={link.key}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-leaf/40 hover:bg-raised"
                  >
                    <SocialIcon network={link.network} className="size-4" /> {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
