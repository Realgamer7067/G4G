"use client";

import { useEffect } from "react";

/** Lenis smooth scrolling for mouse/trackpad users. Skipped on touch devices and under reduced motion. */
export function SmoothScroll() {
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    let destroyed = false;
    let cleanup = () => {};
    void import("lenis").then(({ default: Lenis }) => {
      if (destroyed) return;
      const lenis = new Lenis({ autoRaf: true, duration: 1.05, anchors: true });
      cleanup = () => lenis.destroy();
    });
    return () => {
      destroyed = true;
      cleanup();
    };
  }, []);
  return null;
}
