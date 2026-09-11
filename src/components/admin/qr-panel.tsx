"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { CopyButton } from "./copy-button";
import { Switch } from "@/components/ui/switch";

export type QrTarget = { key: string; label: string; target: string; url: string };

/** Preview, download (PNG/SVG, plain or branded) and copy the URL behind each QR code. */
export function QrPanel({ targets }: { targets: QrTarget[] }) {
  const [branded, setBranded] = useState(true);
  const [active, setActive] = useState(targets[0]?.key);
  const current = targets.find((t) => t.key === active) ?? targets[0];
  if (!current) return null;
  const src = (format: "png" | "svg", download = false) =>
    `/api/admin/qr?target=${encodeURIComponent(current.target)}&format=${format}&branded=${branded ? 1 : 0}${download ? "&download=1" : ""}`;

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-start">
      <div className="overflow-hidden rounded-2xl border border-line bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated on demand by the admin QR route */}
        <img key={src("png")} src={src("png")} alt={`QR code for ${current.label}`} width={164} height={164} className="size-full" />
      </div>
      <div className="grid gap-3">
        {targets.length > 1 && (
          <div role="radiogroup" aria-label="QR destination" className="inline-flex w-fit rounded-full border border-line bg-night p-0.5">
            {targets.map((t) => (
              <label key={t.key} className="cursor-pointer rounded-full px-3 py-1 text-xs text-muted has-[:checked]:bg-raised has-[:checked]:text-frost">
                <input type="radio" name="qr-target" className="sr-only" checked={t.key === current.key} onChange={() => setActive(t.key)} />
                {t.label}
              </label>
            ))}
          </div>
        )}
        <code className="break-all rounded-lg border border-line bg-night px-3 py-2 font-mono text-xs text-muted">{current.url}</code>
        <Switch label="Chapter colours and logo" checked={branded} onChange={(e) => setBranded(e.target.checked)} />
        <div className="flex flex-wrap gap-2">
          <a href={src("png", true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-raised px-3 text-[13px] hover:bg-[#1d3527]">
            <Download className="size-3.5" aria-hidden="true" /> PNG
          </a>
          <a href={src("svg", true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-raised px-3 text-[13px] hover:bg-[#1d3527]">
            <Download className="size-3.5" aria-hidden="true" /> SVG
          </a>
          <CopyButton value={current.url} label="Copy URL" />
        </div>
      </div>
    </div>
  );
}
