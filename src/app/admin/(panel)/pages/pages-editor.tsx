"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { SaveBar, fieldErrorFor, useFormAction } from "@/components/admin/form-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PageKey } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils/cn";
import { savePagesAction } from "@/server/actions/pages";

export type EditablePage = {
  key: PageKey;
  enabled: boolean;
  showInNav: boolean;
  navLabel: string;
  seoTitle: string | null;
  seoDescription: string | null;
  href: string;
  implemented: boolean;
};

const PAGE_NAMES: Record<PageKey, string> = {
  HOME: "Home",
  ABOUT: "About",
  EVENTS: "Events",
  TEAM: "Team",
  GALLERY: "Gallery",
  ANNOUNCEMENTS: "Announcements",
  SPONSORS: "Sponsors & partners",
  CONTACT: "Contact",
};

export function PagesEditor({ pages }: { pages: EditablePage[] }) {
  const { state, pending, onSubmit } = useFormAction(savePagesAction);
  const [order, setOrder] = useState(pages.map((p) => p.key));
  const [enabled, setEnabled] = useState(Object.fromEntries(pages.map((p) => [p.key, p.enabled])) as Record<PageKey, boolean>);
  const byKey = Object.fromEntries(pages.map((p) => [p.key, p])) as Record<PageKey, EditablePage>;

  const move = (index: number, by: -1 | 1) =>
    setOrder((list) => {
      const next = [...list];
      const [key] = next.splice(index, 1);
      next.splice(index + by, 0, key);
      return next;
    });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="order" value={JSON.stringify(order)} />
      <ol className="grid gap-3">
        {order.map((key, index) => {
          const page = byKey[key];
          const live = page.implemented && (key === "HOME" || enabled[key]);
          const status = !page.implemented ? "Not available yet" : live ? "Live" : "Off";
          return (
            <li key={key} className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col">
                  <button type="button" aria-label={`Move ${PAGE_NAMES[key]} up`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-md p-1 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`Move ${PAGE_NAMES[key]} down`} disabled={index === order.length - 1} onClick={() => move(index, 1)} className="rounded-md p-1 text-muted hover:bg-raised hover:text-frost disabled:opacity-30">
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-semibold">{PAGE_NAMES[key]}</span>
                  <span className="font-mono text-xs text-muted">{page.href}</span>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    status === "Live" && "border-leaf/30 bg-leaf/10 text-leaf",
                    status === "Off" && "border-line text-muted",
                    status === "Not available yet" && "border-dashed border-line text-muted",
                  )}
                >
                  {status}
                </span>
                {live && (
                  <a href={page.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-leaf hover:underline">
                    View <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-[auto_auto_1fr] sm:items-end">
                {key === "HOME" ? (
                  <input type="hidden" name="HOME.enabled" value="on" />
                ) : (
                  <Switch
                    name={`${key}.enabled`}
                    label="Page on"
                    checked={enabled[key]}
                    onChange={(e) => setEnabled((s) => ({ ...s, [key]: e.target.checked }))}
                  />
                )}
                <Switch name={`${key}.showInNav`} label="Show in menu" defaultChecked={page.showInNav} />
                <Field label="Menu label" htmlFor={`${key}-label`} error={fieldErrorFor(state, `${key}.navLabel`)}>
                  <Input id={`${key}-label`} name={`${key}.navLabel`} defaultValue={page.navLabel} maxLength={30} required />
                </Field>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-[13px] text-muted hover:text-frost">Search engine text</summary>
                <div className="mt-3 grid gap-3">
                  <Field label="Page title" htmlFor={`${key}-seoTitle`} error={fieldErrorFor(state, `${key}.seoTitle`)} hint="Leave empty to use the page name.">
                    <Input id={`${key}-seoTitle`} name={`${key}.seoTitle`} defaultValue={page.seoTitle ?? ""} maxLength={70} />
                  </Field>
                  <Field label="Description" htmlFor={`${key}-seoDescription`} error={fieldErrorFor(state, `${key}.seoDescription`)} hint="Leave empty to use the site default.">
                    <Textarea id={`${key}-seoDescription`} name={`${key}.seoDescription`} rows={2} defaultValue={page.seoDescription ?? ""} maxLength={200} />
                  </Field>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
      <SaveBar state={state} pending={pending} savedMessage="Pages saved. The menu is updated." />
    </form>
  );
}
