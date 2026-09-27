"use client";

import { useLayoutEffect } from "react";

let played = false;

/**
 * The hero entrance should play on the first page load only, not every time the visitor navigates back home.
 * On later client-side visits this marks the hero static before the browser paints.
 */
export function HeroIntroOnce({ targetId }: { targetId: string }) {
  useLayoutEffect(() => {
    if (played) document.getElementById(targetId)?.classList.add("hero-static");
    played = true;
  }, [targetId]);
  return null;
}
