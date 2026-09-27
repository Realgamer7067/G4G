"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { cn } from "@/lib/utils/cn";

/** A vertical rule that draws itself as its container scrolls through the viewport. Fully drawn under reduced motion. */
export function ScrollLine({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <div ref={ref} className={cn("relative", className)}>
      <span aria-hidden="true" className="absolute bottom-0 left-[7px] top-0 w-px bg-line" />
      <motion.span data-motion="" aria-hidden="true" className="absolute bottom-0 left-[7px] top-0 w-px origin-top bg-leaf" style={{ scaleY }} />
      {children}
    </div>
  );
}
