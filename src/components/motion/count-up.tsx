"use client";

import { useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";

// Ease-out-expo; a plain rAF loop keeps Motion's animation engine out of the initial bundle.
const easeOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Counts from 0 to `value` once in view. The final value is in the DOM from the start (SSR, no-JS, reduced motion). */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const format = (n: number) => Math.round(n).toLocaleString("en-IN");

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduce || value === 0) return;
    const duration = Math.min(2000, 800 + value * 2.5);
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = format(value * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
