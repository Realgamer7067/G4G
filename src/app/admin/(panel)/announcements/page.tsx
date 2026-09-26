import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Input } from "@/components/ui/input";
import type { Prisma } from "@/generated/prisma/client";
import { ANNOUNCEMENT_PRIORITY_LABELS } from "@/lib/announcements/schema";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Announcements" };

const VIEWS = ["all", "published", "draft"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { all: "All", published: "Published", draft: "Drafts" };

function whereFor(view: View): Prisma.AnnouncementWhereInput {
  if (view === "published") return { status: "PUBLISHED" };
  if (view === "draft") return { status: "DRAFT" };
  return {};
}

export default async function AnnouncementsAdminPage({ searchParams }: PageProps<"/admin/announcements">) {
  const me = await requirePagePermission("announcements.manage");
  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "all";
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const where: Prisma.AnnouncementWhereInput = { AND: [whereFor(view), q ? { title: { contains: q, mode: "insensitive" } } : {}] };

  const [rows, ...counts] = await Promise.all([
    db.announcement.findMany({ where, orderBy: [{ pinned: "desc" }, { publishAt: "desc" }], take: 100 }),
    ...VIEWS.map((v) => db.announcement.count({ where: whereFor(v) })),
  ]);

  return (
    <div className="grid max-w-5xl gap-8">
      <PageHeader
        eyebrow="Content"
        title="Announcements"
        description="Post updates, deadlines and news for the chapter site."
        actions={
          <Link href="/admin/announcements/new" className="inline-flex h-10 items-center gap-2 rounded-full bg-leaf px-4 text-sm font-semibold text-night">
            <Plus className="size-4" aria-hidden="true" /> New announcement
          </Link>
        }
      />
      {sp.deleted && (
        <p role="status" className="rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          Announcement deleted.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter announcements" className="flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
          {VIEWS.map((v, i) => (
            <Link
              key={v}
              href={`/admin/announcements?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              aria-current={v === view ? "page" : undefined}
              className={cn("rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-frost", v === view && "bg-raised text-frost")}
            >
              {VIEW_LABELS[v]} <span className="text-xs text-muted">{counts[i]}</span>
            </Link>
          ))}
        </nav>
        <form method="get" className="relative w-full sm:w-72">
          <input type="hidden" name="view" value={view} />
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Search by title" aria-label="Search announcements" className="pl-9" />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line p-10 text-center">
          <p className="font-medium">{q ? "No announcements match that search." : `No ${VIEW_LABELS[view].toLowerCase()} announcements.`}</p>
          {can(me, "announcements.manage") && (
            <Link href="/admin/announcements/new" className="text-sm text-leaf hover:underline">
              Create an announcement
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/announcements/${a.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-leaf/30">
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate font-semibold">{a.title}</span>
                    {a.pinned && <span className="rounded-full border border-leaf/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-leaf">Pinned</span>}
                  </span>
                  <span className="truncate text-sm text-muted">{a.summary || "No summary"}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em]", a.status === "PUBLISHED" ? "bg-leaf/15 text-leaf" : "bg-raised text-muted")}>
                  {a.status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
                <span className="hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted sm:inline">{ANNOUNCEMENT_PRIORITY_LABELS[a.priority]}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
