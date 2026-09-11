import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { LogoTile } from "@/components/brand/logo-tile";
import type { SiteSettingsDTO } from "@/lib/data/site";
import type { NavItem } from "@/lib/pages/registry";
import { Rings } from "./rings";
import { SocialIcon, socialLinks } from "./social-icons";

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = /^https?:/.test(href);
  const className = "text-sm text-muted transition-colors hover:text-frost";
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
      <Rings className="pointer-events-none absolute -left-64 -top-40 -z-10 size-[620px] opacity-30" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_2fr] lg:px-8">
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
                    className="grid size-10 place-items-center rounded-full border border-line bg-night/60 text-muted transition-colors hover:border-leaf/50 hover:text-leaf"
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
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-leaf">{col.title}</p>
              <ul className="grid gap-2">
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
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-leaf">Contact</p>
              <ul className="grid gap-2.5 text-sm text-muted">
                {settings.email && (
                  <li className="flex gap-2">
                    <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <a href={`mailto:${settings.email}`} className="break-all hover:text-frost">
                      {settings.email}
                    </a>
                  </li>
                )}
                {settings.phone && (
                  <li className="flex gap-2">
                    <Phone aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <a href={`tel:${settings.phone.replace(/\s+/g, "")}`} className="hover:text-frost">
                      {settings.phone}
                    </a>
                  </li>
                )}
                {settings.address && (
                  <li className="flex gap-2">
                    <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    {settings.mapUrl ? (
                      <a href={settings.mapUrl} target="_blank" rel="noopener noreferrer" className="whitespace-pre-line hover:text-frost">
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
      <div className="border-t border-line/70">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted sm:px-6 lg:px-8">
          © {year} {settings.footer.copyright || settings.clubName}
        </p>
      </div>
    </footer>
  );
}
