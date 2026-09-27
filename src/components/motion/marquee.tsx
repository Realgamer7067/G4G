/** Seamless horizontal marquee (CSS only). Pauses on hover/focus; static under reduced motion. */
export function Marquee({ items, duration = 40, className }: { items: string[]; duration?: number; className?: string }) {
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <li key={`${item}-${i}`} className="flex items-center">
          <span className="px-6 font-display text-3xl font-semibold tracking-tight text-frost/85 sm:px-9 sm:text-5xl">{item}</span>
          <span aria-hidden="true" className="size-2 rotate-45 bg-leaf/70" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`marquee overflow-hidden ${className ?? ""}`} style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
      <div className="marquee-track flex w-max" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
