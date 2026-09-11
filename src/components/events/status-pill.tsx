import { STATUS_META, type EventDisplayStatus } from "@/lib/events/status";
import { cn } from "@/lib/utils/cn";

const TONES = {
  leaf: "border-leaf/30 bg-leaf/10 text-leaf",
  mint: "border-mint/20 bg-mint/5 text-mint",
  amber: "border-amber/30 bg-amber/10 text-amber",
  danger: "border-danger/30 bg-danger/10 text-danger",
  muted: "border-line bg-night/40 text-muted",
  draft: "border-dashed border-line text-muted",
} as const;

export function StatusPill({ status, className }: { status: EventDisplayStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur", TONES[meta.tone], className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full bg-current", status === "ONGOING" && "motion-safe:animate-pulse")} />
      {meta.label}
    </span>
  );
}
