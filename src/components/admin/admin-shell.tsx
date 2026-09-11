"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/** Sidebar content is rendered on the server and passed in; this only handles the mobile drawer. */
export function AdminShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  // Remember which page the drawer was opened on, so navigating away closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-leaf focus:px-3 focus:py-2 focus:text-night"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-pine lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-pine/90 px-4 py-3 backdrop-blur lg:hidden">
        <span className="text-sm font-semibold">GFG Chapter Admin</span>
        <button
          type="button"
          onClick={() => setOpenOn(pathname)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-lg p-2 text-muted hover:bg-raised hover:text-frost"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <button type="button" aria-label="Close menu" tabIndex={-1} className="absolute inset-0 bg-night/70" onClick={close} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-line bg-pine">
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              autoFocus
              className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-raised hover:text-frost"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            {sidebar}
          </div>
        </div>
      )}
      <main id="admin-main" className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
