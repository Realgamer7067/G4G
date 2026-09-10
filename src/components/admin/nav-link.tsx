"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function NavLink({ href, compact = false, children }: { href: string; compact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg text-sm transition-colors",
        compact ? "h-8 px-2.5 text-[13px]" : "h-9 px-3",
        active
          ? "bg-raised text-frost shadow-[inset_0_0_0_1px_var(--color-line)]"
          : "text-muted hover:bg-raised/60 hover:text-frost",
      )}
    >
      {children}
    </Link>
  );
}
