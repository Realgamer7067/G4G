"use client";

import { useId, useState } from "react";

const W = 640;
const H = 190;
const PAD = { l: 34, r: 14, t: 14, b: 26 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Single-series trend (title names the series, so no legend). Hover or arrow keys show a crosshair and exact value. */
export function AreaChart({ data, title, unit }: { data: { day: string; count: number }[]; title: string; unit: [string, string] }) {
  const gradient = useId();
  const [active, setActive] = useState<number | null>(null);
  const n = data.length;
  const max = niceMax(Math.max(1, ...data.map((d) => d.count)));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const total = data.reduce((s, d) => s + d.count, 0);
  const shown = active ?? n - 1;
  const word = (c: number) => (c === 1 ? unit[0] : unit[1]);

  function pick(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    setActive(Math.max(0, Math.min(n - 1, Math.round(((px - PAD.l) / innerW) * (n - 1)))));
  }

  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-lg font-semibold">{title}</span>
        <span className="text-sm text-muted" aria-live="polite">
          {dayLabel(data[shown].day)} · <span className="font-semibold tabular-nums text-frost">{data[shown].count}</span> {word(data[shown].count)}
        </span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
          role="img"
          aria-label={`${title}: ${total} ${word(total)} over ${n} days`}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n - 1) - 1));
            if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? n - 1) + 1));
            if (e.key === "Escape") setActive(null);
          }}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-leaf)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-leaf)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)" className="tabular-nums">
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}
          <path d={area} fill={`url(#${gradient})`} />
          <path d={line} fill="none" stroke="var(--color-leaf)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11" fill="var(--color-muted)">
              {dayLabel(data[i].day)}
            </text>
          ))}
          {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={y(0)} stroke="var(--color-muted)" strokeWidth="1" strokeDasharray="2 3" />}
          <circle cx={x(shown)} cy={y(data[shown].count)} r="5" fill="var(--color-leaf)" stroke="var(--color-surface)" strokeWidth="2" />
        </svg>
      </div>
      <details className="text-sm text-muted">
        <summary className="cursor-pointer hover:text-frost">Show as a table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-left">
            <thead className="bg-pine text-xs">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Day</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{unit[1]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((d) => (
                <tr key={d.day}>
                  <td className="px-3 py-1">{dayLabel(d.day)}</td>
                  <td className="px-3 py-1 text-right tabular-nums text-frost">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
