"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { LogoTile } from "@/components/brand/logo-tile";
import { Magnetic } from "@/components/motion/magnetic";
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
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 16));

  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenOn(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Move focus into the panel so keyboard users land on the first link.
    const id = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a")?.focus());
    return () => {
      cancelAnimationFrame(id);
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
        "sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-200 ease-out",
        scrolled || open ? "border-line/70 bg-night/85 backdrop-blur-xl" : "border-transparent bg-night/40 backdrop-blur-sm",
      )}
    >
      <div className="container-x flex h-16 items-center gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl" aria-label={`${clubName} home`}>
          {brand}
          <span className="hidden truncate font-display text-[15px] font-semibold tracking-tight sm:block">{clubName}</span>
          <span className="truncate font-display text-[15px] font-semibold tracking-tight sm:hidden">{shortName}</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative px-3 py-2 text-sm transition-colors duration-150",
                  active ? "font-medium text-frost" : "text-muted hover:text-frost",
                )}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-3 -bottom-px h-0.5 origin-left rounded-full bg-leaf transition-transform duration-180 ease-out",
                    active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        {cta && (
          <Magnetic className="ml-auto hidden sm:inline-flex lg:ml-2">
            <Link
              href={cta.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-4 py-2 text-sm font-semibold text-night shadow-[0_10px_30px_-12px_rgb(92_201_123/0.7)] transition-[transform,background-color] duration-200 hover:bg-[#72d48e] active:scale-[0.985]"
            >
              {cta.label}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Magnetic>
        )}

        {(nav.length > 0 || cta) && (
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpenOn(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={cn("grid size-11 place-items-center rounded-full text-muted hover:bg-raised hover:text-frost lg:hidden", !cta && "ml-auto")}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            ref={panelRef}
            id="mobile-menu"
            aria-label="Main"
            className="border-t border-line/70 lg:hidden"
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="container-x pb-6 pt-2">
              <ul className="grid divide-y divide-line/60">
                {nav.map((item, i) => (
                  <motion.li
                    key={item.href}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.025, 0.125), ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      className="flex min-h-14 items-center justify-between py-3 font-display text-2xl font-semibold tracking-tight text-frost/90 aria-[current=page]:text-leaf"
                    >
                      {item.label}
                      <ArrowUpRight className="size-5 text-muted" aria-hidden="true" />
                    </Link>
                  </motion.li>
                ))}
              </ul>
              {cta && (
                <Link href={cta.href} onClick={close} className="mt-5 flex h-12 items-center justify-center rounded-full bg-leaf px-4 font-semibold text-night">
                  {cta.label}
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
