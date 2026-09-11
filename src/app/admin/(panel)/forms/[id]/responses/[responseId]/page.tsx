import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { can, requirePagePermission } from "@/lib/auth/guard";
import { loadSiteSettings } from "@/lib/data/site";
import { db } from "@/lib/db";
import { formatAnswer } from "@/lib/forms/engine/display";
import { formDefinitionSchema, type Answers, type Field } from "@/lib/forms/engine/schema";
import { formatInZone } from "@/lib/utils/timezone";
import { DeleteResponse } from "./delete-response";

export const metadata: Metadata = { title: "Response" };

export default async function ResponseDetailPage({ params }: PageProps<"/admin/forms/[id]/responses/[responseId]">) {
  const me = await requirePagePermission("forms.responses.view");
  const { id, responseId } = await params;
  const response = await db.formResponse.findFirst({
    where: { id: responseId, formId: id },
    include: { version: true, form: { select: { name: true } }, event: { select: { id: true, title: true } }, files: { select: { id: true, originalName: true, sizeBytes: true } } },
  });
  if (!response) notFound();

  const { timezone } = await loadSiteSettings();
  const parsed = formDefinitionSchema.safeParse(response.version.definition);
  const data = response.data as Answers;
  const path = Array.isArray(response.pagePath) ? (response.pagePath as string[]) : [];
  const pages = parsed.success ? parsed.data.pages.filter((p) => path.length === 0 || path.includes(p.id)) : [];
  const fileNames = Object.fromEntries(response.files.map((f) => [f.id, f.originalName]));

  return (
    <div className="grid max-w-3xl gap-8">
      <Link href={`/admin/forms/${id}/responses`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-frost">
        <ArrowLeft className="size-4" aria-hidden="true" /> All responses
      </Link>
      <header className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">{response.form.name}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{response.email ?? "Response"}</h1>
        <p className="text-sm text-muted">
          Submitted {formatInZone(response.submittedAt, timezone, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
          {response.event && (
            <>
              {" "}
              · for{" "}
              <Link href={`/admin/events/${response.event.id}`} className="text-leaf hover:underline">
                {response.event.title}
              </Link>
            </>
          )}
          {" "}· form version {response.version.version}
        </p>
      </header>

      {!parsed.success ? (
        <pre className="overflow-x-auto rounded-2xl border border-line bg-surface p-4 font-mono text-xs">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        pages.map((p, i) => {
          const fields = p.blocks.filter((b): b is Field => b.kind === "field");
          if (fields.length === 0) return null;
          return (
            <section key={p.id} className="overflow-hidden rounded-2xl border border-line" aria-labelledby={`page-${p.id}`}>
              <h2 id={`page-${p.id}`} className="bg-raised/60 px-5 py-3 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                {p.title || `Part ${i + 1}`}
              </h2>
              <dl className="divide-y divide-line bg-surface">
                {fields.map((f) => {
                  const value = data[f.id];
                  const shown = formatAnswer(f, value, fileNames);
                  return (
                    <div key={f.id} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
                      <dt className="text-sm text-muted">{f.label}</dt>
                      <dd className="whitespace-pre-line break-words">
                        {f.type === "file" && Array.isArray(value) && value.length > 0 ? (
                          <ul className="grid gap-1.5">
                            {value.map((fid) => (
                              <li key={fid}>
                                <a href={`/api/admin/files/${fid}`} className="inline-flex items-center gap-1.5 text-leaf hover:underline">
                                  <Download className="size-4" aria-hidden="true" /> {fileNames[fid] ?? "Download file"}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : shown ? (
                          shown
                        ) : (
                          <span className="italic text-muted/70">Not provided</span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          );
        })
      )}

      {can(me, "forms.responses.delete") && (
        <section className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold">Delete</h2>
          <p className="text-sm text-muted">Removes this response and any files it included. This can&apos;t be undone.</p>
          <DeleteResponse formId={id} responseId={response.id} />
        </section>
      )}
    </div>
  );
}
