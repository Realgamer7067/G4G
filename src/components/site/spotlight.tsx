"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Mouse-responsive glow for cards: tracks the pointer in CSS variables (--mx/--my), rAF-throttled.
 * Purely decorative; the glow is off under prefers-reduced-motion (see .spotlight in globals.css).
 */
export function Spotlight({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  return (
    <div
      ref={ref}
      className={cn("spotlight", className)}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const { clientX, clientY } = e;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${clientX - r.left}px`);
          el.style.setProperty("--my", `${clientY - r.top}px`);
        });
      }}
    >
      {children}
    </div>
  );
}
