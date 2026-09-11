import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Picture } from "@/components/media/picture";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { SPONSOR_TIER_LABELS } from "@/lib/events/schema";
import { publicImageSelect, toPublicImage } from "@/lib/media/public-image";

export const metadata: Metadata = { title: "Sponsors" };

export default async function SponsorsAdminPage({ searchParams }: PageProps<"/admin/sponsors">) {
  await requirePagePermission("sponsors.manage");
  const sp = await searchParams;
  const sponsors = await db.sponsor.findMany({
    include: { logo: { select: publicImageSelect }, _count: { select: { events: true } } },
    orderBy: [{ isActive: "desc" }, { order: "asc" }, { name: "asc" }],
  });
  return (
    <div className="grid max-w-4xl gap-8">
      <PageHeader
        eyebrow="Content"
        title="Sponsors & partners"
        description="Your sponsor list. Add sponsors to events from the event editor."
        actions={
          <Link href="/admin/sponsors/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            <Plus className="size-4" aria-hidden="true" /> Add sponsor
          </Link>
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Sponsor deleted.
        </p>
      )}
      {sponsors.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">No sponsors yet.</p>
          <Link href="/admin/sponsors/new" className="text-sm text-leaf hover:underline">
            Add the first one
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {sponsors.map((s) => {
            const logo = toPublicImage(s.logo);
            return (
              <li key={s.id}>
                <Link href={`/admin/sponsors/${s.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-leaf/30">
                  <span className="grid h-14 w-24 shrink-0 place-items-center rounded-xl bg-tile p-2">
                    {logo ? <Picture image={logo} sizes="96px" alt="" imgClassName="max-h-10 w-auto object-contain" /> : <span className="text-xs text-night/60">No logo</span>}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-semibold">{s.name}</span>
                    <span className="text-sm text-muted">
                      {s.customLabel || SPONSOR_TIER_LABELS[s.tier]} · {s._count.events} event{s._count.events === 1 ? "" : "s"}
                    </span>
                  </span>
                  {!s.isActive && <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">Inactive</span>}
                  {s.isActive && !s.showOnSponsorsPage && <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">Hidden</span>}
                  <ChevronRight aria-hidden="true" className="size-4 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
