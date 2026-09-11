type Parts = { weekday: string; day: string; month: string; year: string; time: string };

function partsOf(date: Date, timeZone: string): Parts {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    day: get("day"),
    month: get("month"),
    year: get("year"),
    time: `${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`,
  };
}

const DAY = 86_400_000;

/**
 * Human date/time for an event in the site's time zone. Events shorter than 24 hours show one date
 * even if they run past midnight ("Fri, 25 Sep 2026 · 6:00 pm – 1:00 am").
 */
export function formatEventWhen(startIso: string | Date, endIso: string | Date, timeZone: string): { date: string; time: string; full: string } {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const s = partsOf(start, timeZone);
  const e = partsOf(end, timeZone);
  const time = `${s.time} – ${e.time}`;

  let date: string;
  if (end.getTime() - start.getTime() < DAY) date = `${s.weekday}, ${s.day} ${s.month} ${s.year}`;
  else if (s.year === e.year) date = `${s.day} ${s.month} – ${e.day} ${e.month} ${e.year}`;
  else date = `${s.day} ${s.month} ${s.year} – ${e.day} ${e.month} ${e.year}`;

  return { date, time, full: `${date} · ${time}` };
}

/** Short badge parts for cards: { day: "03", month: "OCT" }. */
export function dateBadge(iso: string | Date, timeZone: string): { day: string; month: string } {
  const p = partsOf(new Date(iso), timeZone);
  return { day: p.day.padStart(2, "0"), month: p.month.toUpperCase() };
}
