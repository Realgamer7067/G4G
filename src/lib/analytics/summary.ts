/** Days (YYYY-MM-DD) ending at `endDay`, oldest first. */
export function lastDays(endDay: string, count: number): string[] {
  const end = new Date(`${endDay}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(end.getTime() - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

export type DailyViews = { day: string; views: number };

/** Sums rows per day over the window, filling days with no rows as zero. */
export function dailySeries(rows: readonly { date: Date; views: number }[], days: readonly string[]): DailyViews[] {
  const totals = new Map<string, number>(days.map((d) => [d, 0]));
  for (const r of rows) {
    const day = r.date.toISOString().slice(0, 10);
    if (totals.has(day)) totals.set(day, (totals.get(day) ?? 0) + r.views);
  }
  return days.map((day) => ({ day, views: totals.get(day) ?? 0 }));
}

/** Top paths by total views over the rows given. */
export function topPaths(rows: readonly { path: string; views: number }[], limit: number): { path: string; views: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.path, (totals.get(r.path) ?? 0) + r.views);
  return [...totals.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, limit);
}
