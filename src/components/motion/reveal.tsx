"use client";

import { motion, type HTMLMotionProps } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

type RevealProps = HTMLMotionProps<"div"> & { delay?: number; y?: number; as?: "div" | "section" | "li" | "article" };

// Server and client must render identical markup, so reduced motion is handled in CSS
// (`[data-motion]` is forced to its final state in globals.css, and by a <noscript> rule without JS).

/** Fades and lifts its children in the first time they enter the viewport. Static under reduced motion. */
export function Reveal({ delay = 0, y = 20, as = "div", children, ...rest }: RevealProps) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      data-motion=""
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Parent for staggered children: wrap each child in `<StaggerItem>`. */
export function Stagger({ step = 0.07, className, children, as = "div" }: { step?: number; className?: string; children: React.ReactNode; as?: "div" | "ul" | "ol" }) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: step } } }}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({ className, children, as = "div", y = 18 }: { className?: string; children: React.ReactNode; as?: "div" | "li" | "article"; y?: number }) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag data-motion="" className={className} variants={{ hidden: { opacity: 0, y }, shown: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }}>
      {children}
    </Tag>
  );
}
