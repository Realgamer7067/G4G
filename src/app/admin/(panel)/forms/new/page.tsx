import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { requirePagePermission } from "@/lib/auth/guard";
import { NewFormForm } from "./new-form-form";

export const metadata: Metadata = { title: "New form" };

export default async function NewFormPage() {
  await requirePagePermission("forms.create");
  return (
    <div className="grid max-w-2xl gap-8">
      <Link href="/admin/forms" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All forms
      </Link>
      <PageHeader eyebrow="Forms" title="New form" description="Start with a name. You'll add pages, questions and logic in the builder next." />
      <Panel title="Name">
        <NewFormForm />
      </Panel>
    </div>
  );
}
