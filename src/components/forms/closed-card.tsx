import Link from "next/link";
import { Lock } from "lucide-react";

export function ClosedCard({ title, reason, backHref, backLabel }: { title: string; reason: string; backHref?: string; backLabel?: string }) {
  return (
    <div className="mx-auto grid w-full max-w-lg justify-items-center gap-4 rounded-[28px] border border-line bg-surface/95 px-8 py-14 text-center shadow-[0_50px_100px_-40px_rgb(0_0_0/0.9)]">
      <span className="grid size-14 place-items-center rounded-full border border-line bg-night text-muted">
        <Lock className="size-6" aria-hidden="true" />
      </span>
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-muted">{reason}</p>
      {backHref && (
        <Link href={backHref} className="mt-2 inline-flex h-11 items-center rounded-full border border-line px-5 text-sm hover:border-leaf/40">
          {backLabel ?? "Go back"}
        </Link>
      )}
    </div>
  );
}
