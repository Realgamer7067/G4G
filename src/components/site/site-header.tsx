"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LogoTile } from "@/components/brand/logo-tile";
import { Picture } from "@/components/media/picture";
import type { PublicImage } from "@/lib/media/public-image";
import type { NavItem } from "@/lib/pages/registry";
import type { NavCta } from "@/lib/settings/schema";
import { cn } from "@/lib/utils/cn";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({
  clubName,
  shortName,
  nav,
  cta,
  logo,
}: {
  clubName: string;
  shortName: string;
  nav: NavItem[];
  cta: NavCta | null;
  logo: PublicImage | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const brand = logo ? (
    <span className="grid size-10 place-items-center rounded-[10px] bg-tile p-1 shadow-[0_0_0_1px_rgb(189_243_203/0.35)]">
      <Picture image={logo} sizes="40px" alt="" imgClassName="size-8 object-contain" priority />
    </span>
  ) : (
    <LogoTile size="sm" priority />
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled || open ? "border-b border-line/70 bg-night/80 backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl" aria-label={`${clubName} home`}>
          {brand}
          <span className="hidden truncate font-display text-[15px] font-semibold tracking-tight sm:block">{clubName}</span>
          <span className="truncate font-display text-[15px] font-semibold tracking-tight sm:hidden">{shortName}</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={cn(
                "relative rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:text-frost",
                "aria-[current=page]:text-frost after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-leaf after:transition-transform aria-[current=page]:after:scale-x-100",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {cta && (
          <Link
            href={cta.href}
            className="ml-auto hidden rounded-full bg-leaf px-4 py-2 text-sm font-semibold text-night shadow-[0_10px_30px_-12px_rgb(92_201_123/0.7)] transition-transform hover:-translate-y-px sm:inline-flex lg:ml-2"
          >
            {cta.label}
          </Link>
        )}

        {(nav.length > 0 || cta) && (
          <button
            type="button"
            onClick={() => setOpenOn(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={cn("rounded-full p-2 text-muted hover:bg-raised hover:text-frost lg:hidden", !cta && "ml-auto")}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        )}
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line/70 px-4 pb-6 pt-2 lg:hidden">
          <ul className="grid gap-1">
            {nav.map((item, i) => (
              <li key={item.href} className="motion-safe:animate-[menu-in_.35s_both]" style={{ animationDelay: `${i * 35}ms` }}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="flex items-center justify-between rounded-xl px-3 py-3 font-display text-2xl font-semibold tracking-tight text-frost/90 hover:bg-raised aria-[current=page]:text-leaf"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {cta && (
            <Link href={cta.href} className="mt-4 flex justify-center rounded-full bg-leaf px-4 py-3 font-semibold text-night">
              {cta.label}
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
