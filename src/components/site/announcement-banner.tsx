"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { dismissalKey, type BannerAnnouncement } from "@/lib/announcements/visibility";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "gfg-dismissed-announcement";

const TONE: Record<BannerAnnouncement["priority"], string> = {
  NORMAL: "border-line bg-surface",
  IMPORTANT: "border-amber/40 bg-amber/10",
  URGENT: "border-danger/40 bg-danger/10",
};

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Reads the persisted dismissal key via useSyncExternalStore so the server snapshot (null) matches
 * the first client render — no hydration mismatch, and no synchronous setState in an effect body
 * (react-hooks/set-state-in-effect forbids that). `dismissedKey` is local state set only from the
 * dismiss click handler (compared by key, so a new announcement is never hidden by an old dismissal), so dismissal hides the banner immediately without waiting on storage events.
 */
export function AnnouncementBanner({ announcement }: { announcement: BannerAnnouncement }) {
  const key = dismissalKey(announcement);
  const storedKey = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // Ignore: dismissal just won't persist across reloads.
    }
    setDismissedKey(key);
  }, [key]);

  if (storedKey === key || dismissedKey === key) return null;

  const href = announcement.linkUrl || `/announcements/${announcement.slug}`;
  const external = Boolean(announcement.linkUrl);

  return (
    <aside aria-label="Announcement" className={cn("border-b py-2.5 text-sm", TONE[announcement.priority])}>
      <div className="container-x flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate">
          <Link href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="hover:underline">
            <span className="font-semibold">{announcement.title}</span>
            {announcement.summary && <span className="text-muted"> — {announcement.summary}</span>}
          </Link>
        </p>
        <button type="button" aria-label="Dismiss announcement" onClick={dismiss} className="shrink-0 rounded-md p-1 text-muted hover:bg-raised hover:text-frost">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
