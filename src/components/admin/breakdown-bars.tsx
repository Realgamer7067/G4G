/** Horizontal bars for how often each option was picked. One hue (magnitude), values in text tokens. */
export function BreakdownBars({ title, rows, answered }: { title: string; rows: { id: string; label: string; count: number }[]; answered: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <figure className="grid content-start gap-3">
      <figcaption className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted">
          {answered} answer{answered === 1 ? "" : "s"}
        </span>
      </figcaption>
      <ul className="grid gap-2">
        {rows.map((r) => {
          const pct = answered ? Math.round((r.count / answered) * 100) : 0;
          return (
            <li key={r.id} className="group grid gap-1" title={`${r.label}: ${r.count} (${pct}%)`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {r.count} · {pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line/60" aria-hidden="true">
                <div
                  className="h-full rounded-r-[4px] bg-leaf/70 transition-colors group-hover:bg-leaf"
                  style={{ width: `${r.count === 0 ? 0 : Math.max(2, (r.count / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
