"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CalendarPlus, Check, Clock, Hourglass, Loader2, MapPin, Users, X } from "lucide-react";
import { Picture } from "@/components/media/picture";
import { formatAnswer } from "@/lib/forms/engine/display";
import { evaluateForm } from "@/lib/forms/engine/evaluate";
import type { AnswerValue, Answers, ContentBlock, Field, FormDefinition } from "@/lib/forms/engine/schema";
import { validatePage, validateSubmission } from "@/lib/forms/engine/validate-submission";
import type { PublicImage } from "@/lib/media/public-image";
import { cn } from "@/lib/utils/cn";
import { FieldInput, type UploadedFile } from "./field-input";

export type WizardMeta = { icon: "calendar" | "clock" | "pin" | "seats" | "closes"; text: string; strong?: boolean };
export type ContentImage = { url: string; width: number; height: number; alt: string };

const ICONS = { calendar: CalendarDays, clock: Clock, pin: MapPin, seats: Users, closes: Hourglass } as const;

type Step = { kind: "page"; pageId: string; title: string } | { kind: "review"; title: string };

function Content({ block, images }: { block: ContentBlock; images: Record<string, ContentImage> }) {
  switch (block.type) {
    case "heading":
      return <h3 className="font-display text-xl font-bold tracking-tight sm:col-span-2">{block.text}</h3>;
    case "divider":
      return <hr className="border-line sm:col-span-2" />;
    case "callout":
      return (
        <p className={cn("whitespace-pre-line rounded-xl border p-4 text-sm sm:col-span-2", block.tone === "warning" ? "border-amber/30 bg-amber/10 text-amber" : "border-leaf/25 bg-leaf/5 text-frost")}>
          {block.text}
        </p>
      );
    case "image": {
      const img = block.uploadId ? images[block.uploadId] : undefined;
      if (!img) return null;
      // eslint-disable-next-line @next/next/no-img-element -- pre-sized public variant
      return <img src={img.url} width={img.width} height={img.height} alt={img.alt} loading="lazy" className="w-full rounded-xl border border-line sm:col-span-2" />;
    }
    default:
      return <p className="whitespace-pre-line text-[15px] text-muted sm:col-span-2">{block.text}</p>;
  }
}

/**
 * Public multi-page form (layout from the user's reference card). The same engine that validates on the
 * server decides which pages, questions and options appear here, so the two can't disagree.
 */
export function FormWizard({
  slug,
  versionId,
  definition,
  title,
  eyebrow,
  description,
  submitLabel,
  successMessage,
  reviewStep,
  cover,
  meta,
  images = {},
  eventSlug = null,
  closeHref = null,
  calendarUrl = null,
  preview = false,
}: {
  slug: string;
  versionId: string;
  definition: FormDefinition;
  title: string;
  eyebrow?: string;
  description?: string;
  submitLabel: string;
  successMessage: string;
  reviewStep: boolean;
  cover: PublicImage | null;
  meta: WizardMeta[];
  images?: Record<string, ContentImage>;
  eventSlug?: string | null;
  closeHref?: string | null;
  calendarUrl?: string | null;
  preview?: boolean;
}) {
  const storageKey = `gfg-form:${versionId}${eventSlug ? `:${eventSlug}` : ""}`;
  const [answers, setAnswers] = useState<Answers>({});
  const [uploads, setUploads] = useState<Record<string, UploadedFile>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const startedAt = useRef<number>(0);
  const started = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const fileFieldIds = useMemo(
    () => new Set(definition.pages.flatMap((p) => p.blocks).filter((b) => b.kind === "field" && b.type === "file").map((b) => b.id)),
    [definition],
  );

  // Restore a saved draft and count a view (once, after hydration). The server can't see localStorage,
  // so the draft is applied on the next tick instead of during hydration.
  useEffect(() => {
    startedAt.current = Date.now();
    const restore = setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setAnswers(JSON.parse(saved) as Answers);
      } catch {
        // storage unavailable: start fresh
      }
    }, 0);
    if (!preview) void fetch(`/api/forms/${slug}/beacon`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "view" }), keepalive: true }).catch(() => undefined);
    return () => clearTimeout(restore);
  }, [storageKey, slug, preview]);

  // Autosave everything except file answers (uploads can't be restored across sessions).
  useEffect(() => {
    if (done || preview || Object.keys(answers).length === 0) return;
    const t = setTimeout(() => {
      try {
        const toSave = Object.fromEntries(Object.entries(answers).filter(([k]) => !fileFieldIds.has(k)));
        localStorage.setItem(storageKey, JSON.stringify(toSave));
        setSavedAt(Date.now());
      } catch {
        setSavedAt(null);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [answers, done, preview, storageKey, fileFieldIds]);

  const ev = useMemo(() => evaluateForm(definition, answers), [definition, answers]);
  const steps: Step[] = useMemo(() => {
    const pages = ev.path.map((id, i) => {
      const p = definition.pages.find((x) => x.id === id)!;
      return { kind: "page" as const, pageId: id, title: p.title || `Part ${i + 1}` };
    });
    return reviewStep ? [...pages, { kind: "review" as const, title: "Review" }] : pages;
  }, [ev.path, definition, reviewStep]);
  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const page = step.kind === "page" ? definition.pages.find((p) => p.id === step.pageId) : null;

  const go = useCallback((i: number) => {
    setStepIndex(i);
    setServerError(null);
    requestAnimationFrame(() => heading.current?.focus());
  }, []);

  function setAnswer(id: string, value: AnswerValue) {
    if (!started.current && !preview) {
      started.current = true;
      void fetch(`/api/forms/${slug}/beacon`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "start" }), keepalive: true }).catch(() => undefined);
    }
    setAnswers((a) => ({ ...a, [id]: value }));
    setErrors((e) => {
      if (!e[id]) return e;
      const { [id]: _removed, ...rest } = e;
      return rest;
    });
  }

  function focusFirstError(errs: Record<string, string>) {
    const first = Object.keys(errs)[0];
    if (first) requestAnimationFrame(() => document.getElementById(`q-${first}`)?.focus());
  }

  async function submit() {
    const check = validateSubmission(definition, answers);
    if (!check.ok) {
      setErrors(check.errors);
      const firstPage = steps.findIndex((s) => s.kind === "page" && definition.pages.find((p) => p.id === s.pageId)?.blocks.some((b) => check.errors[b.id]));
      if (firstPage >= 0) go(firstPage);
      focusFirstError(check.errors);
      return;
    }
    if (preview) {
      setServerError("This is a preview. Publish the form to collect responses.");
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/forms/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, answers, startedAt: startedAt.current, honeypot: honeypot.current?.value ?? "", event: eventSlug }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> };
      if (res.ok && json.ok) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // ignore
        }
        setDone(json.message ?? successMessage);
        return;
      }
      if (json.fieldErrors) {
        setErrors(json.fieldErrors);
        const firstPage = steps.findIndex((s) => s.kind === "page" && definition.pages.find((p) => p.id === s.pageId)?.blocks.some((b) => json.fieldErrors?.[b.id]));
        if (firstPage >= 0) go(firstPage);
      }
      setServerError(json.error ?? "Something went wrong. Try again.");
    } catch {
      setServerError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (page) {
      const errs = validatePage(definition, answers, page.id);
      if (Object.keys(errs).length) {
        setErrors((e) => ({ ...e, ...errs }));
        focusFirstError(errs);
        return;
      }
    }
    if (isLast) void submit();
    else go(index + 1);
  }

  const progress = done ? 100 : Math.round(((index + 1) / steps.length) * 100);

  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-line bg-surface/95 shadow-[0_50px_100px_-40px_rgb(0_0_0/0.9)] backdrop-blur-xl lg:grid lg:grid-cols-[330px_1fr]">
      {/* Left rail: what you're signing up for, and where you are. */}
      <aside className="relative hidden flex-col border-r border-line bg-pine lg:flex">
        <div className="relative aspect-[16/10] overflow-hidden">
          {cover ? (
            <Picture image={cover} sizes="330px" alt="" priority imgClassName="size-full object-cover" />
          ) : (
            <div aria-hidden="true" className="size-full bg-[radial-gradient(circle_at_75%_25%,rgb(92_201_123/0.5),transparent_50%),radial-gradient(circle_at_10%_110%,rgb(47_141_70/0.55),transparent_55%)]" />
          )}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-pine via-pine/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 grid gap-1 p-6">
            {eyebrow && <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mint">{eyebrow}</p>}
            <p className="font-display text-2xl font-bold leading-tight">{title}</p>
          </div>
        </div>
        {meta.length > 0 && (
          <ul className="grid gap-2.5 px-6 pt-2 text-sm text-muted">
            {meta.map((m) => {
              const Icon = ICONS[m.icon];
              return (
                <li key={m.text} className={cn("flex items-center gap-2.5", m.strong && "font-semibold text-frost")}>
                  <Icon aria-hidden="true" className="size-4 shrink-0" /> {m.text}
                </li>
              );
            })}
          </ul>
        )}
        <nav aria-label="Form steps" className="mt-auto px-6 pb-7 pt-10">
          <ol className="grid gap-3">
            {steps.map((s, i) => {
              const state = done || i < index ? "done" : i === index ? "current" : "todo";
              return (
                <li key={s.kind === "page" ? s.pageId : "review"}>
                  <button
                    type="button"
                    disabled={state !== "done" || Boolean(done)}
                    onClick={() => go(i)}
                    aria-current={state === "current" ? "step" : undefined}
                    className="flex w-full items-center gap-3 rounded-lg text-left text-sm disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                        state === "done" && "border-leaf/50 bg-leaf/10 text-leaf",
                        state === "current" && "border-transparent bg-gradient-to-br from-leaf to-mint text-night shadow-[0_0_0_4px_rgb(92_201_123/0.18)]",
                        state === "todo" && "border-line text-muted",
                      )}
                    >
                      {state === "done" ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className={cn(state === "current" ? "font-semibold text-frost" : state === "done" ? "text-frost/80" : "text-muted")}>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </aside>

      <section className="flex min-h-[600px] flex-col" aria-labelledby="wizard-heading">
        <header className="flex items-center gap-4 border-b border-line px-5 py-4 sm:px-7">
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {done ? "Done" : `Step ${index + 1} of ${steps.length}`}
          </p>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className="h-full rounded-full bg-gradient-to-r from-brand via-leaf to-mint transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          {closeHref && (
            <Link href={closeHref} aria-label="Close and go back" className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-frost">
              <X className="size-5" aria-hidden="true" />
            </Link>
          )}
        </header>

        {/* Compact context on small screens, where the rail is hidden. */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3 lg:hidden">
          {cover && (
            <span className="block w-20 shrink-0 overflow-hidden rounded-lg">
              <Picture image={cover} sizes="80px" alt="" imgClassName="aspect-video w-full object-cover" />
            </span>
          )}
          <div className="grid min-w-0 gap-0.5">
            <p className="truncate font-display text-base font-bold">{title}</p>
            {meta[0] && <p className="truncate text-xs text-muted">{meta.slice(0, 2).map((m) => m.text).join(" · ")}</p>}
          </div>
        </div>

        {done ? (
          <div className="grid flex-1 place-items-center px-6 py-14 text-center">
            <div className="grid max-w-md justify-items-center gap-4">
              <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-leaf to-mint text-night shadow-[0_0_0_10px_rgb(92_201_123/0.12)] motion-safe:animate-[pop-in_.5s_cubic-bezier(.2,1.4,.4,1)_both]">
                <Check className="size-8" strokeWidth={3} aria-hidden="true" />
              </span>
              <h2 id="wizard-heading" tabIndex={-1} className="font-display text-3xl font-extrabold tracking-tight">
                {eventSlug ? "You're in!" : "Response recorded"}
              </h2>
              <p className="whitespace-pre-line text-muted" role="status">
                {done}
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {calendarUrl && (
                  <a href={calendarUrl} className="inline-flex h-11 items-center gap-2 rounded-full bg-leaf px-5 font-semibold text-night">
                    <CalendarPlus className="size-4" aria-hidden="true" /> Add to calendar
                  </a>
                )}
                {closeHref && (
                  <Link href={closeHref} className="inline-flex h-11 items-center rounded-full border border-line px-5 text-sm hover:border-leaf/40">
                    Back to the event
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-1 flex-col"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            {/* Honeypot: invisible to people, tempting to bots. */}
            <div aria-hidden="true" className="absolute left-[-9999px] top-auto size-px overflow-hidden">
              <label>
                Leave this empty
                <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            <div key={index} className="flex-1 overflow-y-auto px-5 py-7 motion-safe:animate-[step-in_.35s_ease-out_both] sm:px-7">
              <h2 id="wizard-heading" ref={heading} tabIndex={-1} className="font-display text-2xl font-bold tracking-tight focus:outline-none sm:text-3xl">
                {step.kind === "review" ? "Check it over" : page?.title || title}
              </h2>
              <p className="mt-2 text-muted">
                {step.kind === "review"
                  ? "Last look before you submit. Anything here can still be edited."
                  : page?.description || (index === 0 ? description : "")}
              </p>

              {step.kind === "review" ? (
                <div className="mt-6 grid gap-4">
                  {ev.path.map((pageId) => {
                    const p = definition.pages.find((x) => x.id === pageId)!;
                    const fields = p.blocks.filter((b): b is Field => b.kind === "field" && ev.visibleBlocks.has(b.id));
                    if (fields.length === 0) return null;
                    const stepNumber = steps.findIndex((s) => s.kind === "page" && s.pageId === pageId);
                    return (
                      <section key={pageId} className="overflow-hidden rounded-2xl border border-line" aria-labelledby={`review-${pageId}`}>
                        <div className="flex items-center justify-between bg-raised/60 px-4 py-3">
                          <h3 id={`review-${pageId}`} className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                            {p.title || `Part ${stepNumber + 1}`}
                          </h3>
                          <button type="button" onClick={() => go(stepNumber)} className="font-mono text-xs uppercase tracking-[0.12em] text-leaf hover:text-mint">
                            Edit
                          </button>
                        </div>
                        <dl className="divide-y divide-line">
                          {fields.map((f) => {
                            const shown = formatAnswer(f, ev.cleaned[f.id], Object.fromEntries(Object.values(uploads).map((u) => [u.id, u.name])));
                            return (
                              <div key={f.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-4">
                                <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{f.label}</dt>
                                <dd className={cn("whitespace-pre-line break-words text-[15px]", !shown && "italic text-muted/70")}>{shown || "Not provided"}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  {page?.blocks.map((block) => {
                    if (!ev.visibleBlocks.has(block.id)) return null;
                    if (block.kind === "content") return <Content key={block.id} block={block} images={images} />;
                    return (
                      <FieldInput
                        key={block.id}
                        field={block}
                        value={answers[block.id]}
                        onChange={(v) => setAnswer(block.id, v)}
                        error={errors[block.id]}
                        visibleOptions={ev.visibleOptions.get(block.id)}
                        slug={slug}
                        uploads={uploads}
                        onUploaded={(u) => setUploads((m) => ({ ...m, [u.id]: u }))}
                        preview={preview}
                      />
                    );
                  })}
                </div>
              )}

              {serverError && (
                <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                  {serverError}
                </p>
              )}
            </div>

            <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-night/40 px-5 py-4 sm:px-7">
              {index > 0 ? (
                <button type="button" onClick={() => go(index - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted hover:bg-raised hover:text-frost">
                  <ArrowLeft className="size-4" aria-hidden="true" /> Back
                </button>
              ) : (
                <span />
              )}
              <span className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted" aria-live="polite">
                {savedAt && !preview && (
                  <>
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-leaf" /> Draft saved
                  </>
                )}
                {preview && "Preview"}
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-leaf to-mint px-6 font-semibold text-night shadow-[0_14px_40px_-14px_rgb(92_201_123/0.8)] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
              >
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {isLast ? (submitting ? "Submitting…" : submitLabel) : "Next"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
