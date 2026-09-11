import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { SessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/guard";
import { cn } from "@/lib/utils/cn";
import { FORM_STATUS_META, formStatus } from "../form-status";

type Tab = "build" | "responses" | "settings";

export function FormHeader({
  user,
  form,
  active,
  responseCount,
}: {
  user: SessionUser;
  form: { id: string; name: string; slug: string; visibility: string; publishedVersionId: string | null; hasUnpublishedChanges: boolean; acceptingResponses: boolean; closesAt: Date | null };
  active: Tab;
  responseCount: number;
}) {
  const status = FORM_STATUS_META[formStatus(form)];
  const tabs: { key: Tab; label: string; href: string; show: boolean }[] = [
    { key: "build", label: "Build", href: `/admin/forms/${form.id}/build`, show: can(user, "forms.edit") },
    { key: "responses", label: `Responses (${responseCount})`, href: `/admin/forms/${form.id}/responses`, show: can(user, "forms.responses.view") },
    { key: "settings", label: "Settings", href: `/admin/forms/${form.id}/settings`, show: can(user, "forms.edit") },
  ];
  return (
    <header className="grid gap-4">
      <Link href="/admin/forms" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All forms
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{form.name}</h1>
        <span className={cn("rounded-full border px-2.5 py-1 text-xs", status.className)}>{status.label}</span>
        {form.publishedVersionId && form.visibility === "PUBLIC_LINK" && (
          <a href={`/forms/${form.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-leaf hover:underline">
            /forms/{form.slug} <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
      <nav aria-label="Form sections" className="flex gap-1 border-b border-line">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={t.key === active ? "page" : undefined}
              className={cn("-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm text-muted transition-colors hover:text-frost", t.key === active && "border-leaf text-frost")}
            >
              {t.label}
            </Link>
          ))}
      </nav>
    </header>
  );
}
