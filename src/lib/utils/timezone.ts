/**
 * The site runs in one configured time zone (Settings → Time zone). Admin forms use plain
 * `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` strings in that zone; the database stores UTC.
 */

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Minutes the zone is ahead of UTC at a given instant (IST → 330). */
export function tzOffsetMinutes(at: Date, timeZone: string): number {
  const p = partsIn(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

export function isLocalDateTime(value: string): boolean {
  return LOCAL_RE.test(value);
}

/** Wall-clock time in `timeZone` → UTC instant. Ambiguous times (DST fall-back) resolve to the first occurrence. */
export function zonedToUtc(local: string, timeZone: string): Date {
  const m = LOCAL_RE.exec(local);
  if (!m) throw new Error(`Invalid local date/time: ${local}`);
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
  const first = tzOffsetMinutes(new Date(guess), timeZone);
  let result = guess - first * 60_000;
  const second = tzOffsetMinutes(new Date(result), timeZone);
  if (second !== first) result = guess - second * 60_000;
  return new Date(result);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC instant → `YYYY-MM-DDTHH:mm` in `timeZone`, for `<input type="datetime-local">` defaults. */
export function utcToZonedInput(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Calendar day (`YYYY-MM-DD`) of an instant in `timeZone`. */
export function zonedDay(date: Date, timeZone: string): string {
  return utcToZonedInput(date, timeZone).slice(0, 10);
}

export function formatInZone(date: Date | string, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone, ...options }).format(typeof date === "string" ? new Date(date) : date);
}
