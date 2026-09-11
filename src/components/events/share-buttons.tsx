"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { siWhatsapp, siX } from "simple-icons";

const btn = "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-night/60 px-3.5 text-sm text-muted transition-colors hover:border-leaf/40 hover:text-frost";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const text = encodeURIComponent(`${title} — ${url}`);

  return (
    <div className="flex flex-wrap gap-2">
      {canShare && (
        <button type="button" className={btn} onClick={() => navigator.share({ title, url }).catch(() => undefined)}>
          <Share2 className="size-4" aria-hidden="true" /> Share
        </button>
      )}
      <button
        type="button"
        className={btn}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check className="size-4 text-leaf" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
      <a className={btn} href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
          <path d={siWhatsapp.path} />
        </svg>
      </a>
      <a className={btn} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">
        <span className="text-xs font-bold">in</span>
      </a>
      <a className={btn} href={`https://x.com/intent/post?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X">
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
          <path d={siX.path} />
        </svg>
      </a>
    </div>
  );
}
