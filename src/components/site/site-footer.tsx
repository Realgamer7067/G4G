import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { LogoTile } from "@/components/brand/logo-tile";
import type { SiteSettingsDTO } from "@/lib/data/site";
import type { NavItem } from "@/lib/pages/registry";
import { SocialIcon, socialLinks } from "./social-icons";

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = /^https?:/.test(href);
  const className = "link-sweep text-sm text-muted transition-colors hover:text-frost";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function SiteFooter({ settings, nav }: { settings: SiteSettingsDTO; nav: NavItem[] }) {
  const socials = socialLinks(settings.socials);
  const columns =
    settings.footer.columns.length > 0
      ? settings.footer.columns
      : nav.length > 0
        ? [{ title: "Explore", links: nav.map((n) => ({ label: n.label, href: n.href })) }]
        : [];
  const year = new Date().getFullYear();

  return (
    <footer className="relative isolate mt-24 overflow-hidden border-t border-line bg-pine">
      <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:linear-gradient(to_bottom,transparent,#000_30%,#000)]" />
      <div className="container-x grid gap-12 py-16 lg:grid-cols-[1.3fr_2fr]">
        <div className="grid content-start gap-5">
          <Link href="/" className="flex items-center gap-3">
            <LogoTile size="md" />
            <span className="grid leading-tight">
              <span className="font-display text-lg font-semibold tracking-tight">{settings.clubName}</span>
              {settings.universityName && <span className="text-sm text-muted">{settings.universityName}</span>}
            </span>
          </Link>
          {settings.footer.blurb && <p className="max-w-sm text-sm text-muted">{settings.footer.blurb}</p>}
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Social media">
              {socials.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="grid size-11 place-items-center rounded-full border border-line bg-night/60 text-muted transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-leaf/50 hover:text-leaf"
                  >
                    <SocialIcon network={s.network} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="grid content-start gap-3">
              <p className="text-sm font-semibold text-frost">{col.title}</p>
              <ul className="grid gap-2.5">
                {col.links.map((l) => (
                  <li key={`${l.label}-${l.href}`}>
                    <FooterLink href={l.href}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          {(settings.email || settings.phone || settings.address) && (
            <div className="grid content-start gap-3">
              <p className="text-sm font-semibold text-frost">Contact</p>
              <ul className="grid gap-2.5 text-sm text-muted">
                {settings.email && (
                  <li className="flex gap-2">
                    <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <a href={`mailto:${settings.email}`} className="link-sweep break-all hover:text-frost">
                      {settings.email}
                    </a>
                  </li>
                )}
                {settings.phone && (
                  <li className="flex gap-2">
                    <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <a href={`tel:${settings.phone.replace(/\s+/g, "")}`} className="link-sweep hover:text-frost">
                      {settings.phone}
                    </a>
                  </li>
                )}
                {settings.address && (
                  <li className="flex gap-2">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {settings.mapUrl ? (
                      <a href={settings.mapUrl} target="_blank" rel="noopener noreferrer" className="link-sweep whitespace-pre-line hover:text-frost">
                        {settings.address}
                      </a>
                    ) : (
                      <span className="whitespace-pre-line">{settings.address}</span>
                    )}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="container-x @container" aria-hidden="true">
        {/* Sized from the name's length so the whole wordmark spans the container without clipping. */}
        <p
          style={{ fontSize: `min(11rem, ${(100 / (0.54 * Math.max(settings.shortName.length, 6))).toFixed(2)}cqw)` }}
          className="select-none truncate pb-[0.24em] font-display font-extrabold leading-none tracking-[-0.04em] text-transparent [-webkit-text-stroke:1px_rgb(92_201_123/0.35)]">
          {settings.shortName}
        </p>
      </div>

      <div className="border-t border-line/70">
        <div className="container-x flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-muted">
          <p>
            © {year} {settings.footer.copyright || settings.clubName}
          </p>
          {settings.universityName && <p>{settings.universityName}</p>}
        </div>
      </div>
    </footer>
  );
}
