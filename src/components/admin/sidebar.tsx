import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { LogoTile } from "@/components/brand/logo-tile";
import { logoutAction } from "@/server/actions/auth";
import type { AdminNavItem } from "./nav-items";
import { NavLink } from "./nav-link";

/** Server component: icons are functions and cannot be passed to client components as props. */
export function Sidebar({ items, user }: { items: AdminNavItem[]; user: { name: string; roleName: string } }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/admin" className="flex items-center gap-3 rounded-xl p-1">
        <LogoTile size="sm" />
        <span className="grid leading-tight">
          <span className="text-sm font-semibold">GfG Chapter</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Admin</span>
        </span>
      </Link>
      <nav aria-label="Admin" className="grid gap-1">
        {items.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href}>
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto grid gap-2 rounded-2xl border border-line bg-night/60 p-3">
        <div className="grid leading-tight">
          <span className="truncate text-sm font-semibold">{user.name}</span>
          <span className="text-xs text-muted">{user.roleName}</span>
        </div>
        <div className="flex gap-1">
          <NavLink href="/admin/account" compact>
            <UserRound aria-hidden="true" className="size-4" />
            Account
          </NavLink>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[13px] text-muted transition-colors hover:bg-raised hover:text-frost"
            >
              <LogOut aria-hidden="true" className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
