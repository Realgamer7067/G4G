import { cn } from "@/lib/utils/cn";

/**
 * Shared page header. `layout` picks the composition so inner pages don't all look alike:
 * - "split": title left, lead and `aside` in a right column (events, gallery)
 * - "stacked": oversized title with the lead underneath (team, sponsors)
 * - "narrow": editorial column for reading pages (announcements, contact)
 * Entrance uses the CSS hero-rise classes, so it is server-rendered and honours reduced motion.
 */
export function PageIntro({
  eyebrow,
  title,
  lead,
  aside,
  children,
  layout = "split",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
  layout?: "split" | "stacked" | "narrow";
  className?: string;
}) {
  return (
    <header className={cn("relative isolate", className)}>
      <div aria-hidden="true" className="bg-dots pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_80%_at_85%_0%,#000,transparent_70%)]" />
      <div className={cn("container-x grid gap-6 pb-12 pt-14 sm:pt-20", layout === "narrow" && "max-w-4xl")}>
        {eyebrow && <p className="hero-in-1 font-mono text-xs uppercase tracking-[0.14em] text-leaf">{eyebrow}</p>}
        {layout === "split" ? (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:gap-16">
            <h1 className="hero-in-2 font-display text-5xl font-extrabold leading-[0.95] tracking-[-0.035em] sm:text-6xl lg:text-7xl">{title}</h1>
            {(lead || aside) && (
              <div className="hero-in-3 grid gap-4">
                {lead && <p className="max-w-md text-lg leading-relaxed text-muted">{lead}</p>}
                {aside}
              </div>
            )}
          </div>
        ) : (
          <>
            <h1
              className={cn(
                "hero-in-2 font-display font-extrabold tracking-[-0.035em]",
                layout === "stacked" ? "max-w-5xl text-5xl leading-[0.92] sm:text-7xl lg:text-8xl" : "text-4xl leading-[1] sm:text-6xl",
              )}
            >
              {title}
            </h1>
            {lead && <p className="hero-in-3 max-w-2xl text-lg leading-relaxed text-muted">{lead}</p>}
            {aside && <div className="hero-in-3">{aside}</div>}
          </>
        )}
        {children && <div className="hero-in-3 pt-2">{children}</div>}
      </div>
    </header>
  );
}
