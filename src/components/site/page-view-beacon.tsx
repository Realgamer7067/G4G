"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Reports one anonymous page view per client-side navigation. Respects Do Not Track. */
export function PageViewBeacon() {
  const pathname = usePathname();
  // Guards against React re-running the effect for the same path (StrictMode remounts in development).
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || reported.current === pathname || navigator.doNotTrack === "1") return;
    reported.current = pathname;
    void fetch("/api/v", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
