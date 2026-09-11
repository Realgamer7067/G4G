"use client";

import { useEffect, useState } from "react";

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86_400), hours: Math.floor((total % 86_400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "02 Days : 11 Hours : 32 Minutes" style countdown. Renders nothing once the target passes. */
export function Countdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now === null ? null : new Date(target).getTime() - now;
  if (remaining !== null && remaining <= 0) return null;
  const parts = remaining === null ? null : split(remaining);
  const units = [
    { key: "days", label: "Days" },
    { key: "hours", label: "Hours" },
    { key: "minutes", label: "Minutes" },
    { key: "seconds", label: "Seconds" },
  ] as const;
  const spoken = parts ? `${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes` : "";

  return (
    <div className="grid gap-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{label}</p>
      <div role="timer" aria-label={spoken ? `${label}: ${spoken}` : label} className="flex items-center gap-1.5 sm:gap-2">
        {units.map((u, i) => (
          <div key={u.key} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && (
              <span aria-hidden="true" className="font-display text-xl text-muted/60">
                :
              </span>
            )}
            <span className="grid min-w-14 justify-items-center rounded-2xl border border-line bg-night/70 px-2 py-2 sm:min-w-16">
              <span aria-hidden="true" className="font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
                {parts ? pad(parts[u.key]) : "--"}
              </span>
              <span aria-hidden="true" className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                {u.label}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
