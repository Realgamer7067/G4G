import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { CategoryForm } from "./category-forms";

export const metadata: Metadata = { title: "Event categories" };

export default async function CategoriesPage() {
  await requirePagePermission("events.edit");
  const categories = await db.eventCategory.findMany({ orderBy: { order: "asc" }, include: { _count: { select: { events: true } } } });
  return (
    <div className="grid max-w-3xl gap-8">
      <Link href="/admin/events" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All events
      </Link>
      <PageHeader eyebrow="Events" title="Categories" description="Used to filter events on the website. Deleting a category leaves its events uncategorised." />
      <Panel title="Add a category">
        <CategoryForm />
      </Panel>
      <Panel title={`Categories (${categories.length})`}>
        <ul className="grid gap-3">
          {categories.map((c) => (
            <li key={c.id} className="grid gap-1">
              <CategoryForm id={c.id} name={c.name} eventCount={c._count.events} />
              <span className="text-xs text-muted">
                {c._count.events} event{c._count.events === 1 ? "" : "s"} · /events?category={c.slug}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
