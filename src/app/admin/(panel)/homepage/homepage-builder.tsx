"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { blankSection } from "@/lib/homepage/sections/factories";
import { addSection, removeSection, reorderSections, toggleSection, updateSection } from "@/lib/homepage/sections/ops";
import type { HomepageSections, Section, SectionType } from "@/lib/homepage/sections/schema";
import { publishHomepageAction, saveHomepageDraftAction } from "@/server/actions/homepage";
import { cn } from "@/lib/utils/cn";
import { Inspector } from "./inspector";
import { SectionList } from "./section-list";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function HomepageBuilder({ revisionId, initialSections }: { revisionId: string; initialSections: HomepageSections }) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);

  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  // Same serialized-save pattern as the form builder: at most one save in flight, Publish awaits it
  // so it always publishes what's on screen, not a stale row.
  const flushSave = useCallback((): Promise<boolean> => {
    if (savePromiseRef.current) return savePromiseRef.current;
    const run = async (): Promise<boolean> => {
      let toSave = sectionsRef.current;
      for (;;) {
        setSaveState("saving");
        const result = await saveHomepageDraftAction(revisionId, toSave);
        if (!result.ok) {
          savePromiseRef.current = null;
          setSaveState("error");
          setSaveError(result.error);
          return false;
        }
        setSaveError(null);
        if (sectionsRef.current === toSave) {
          savePromiseRef.current = null;
          setSaveState("saved");
          return true;
        }
        toSave = sectionsRef.current;
      }
    };
    const p = run();
    savePromiseRef.current = p;
    return p;
  }, [revisionId]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushSave(), 800);
  }, [flushSave]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (saveState === "dirty" || saveState === "saving" || saveState === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);

  function apply(fn: (s: HomepageSections) => HomepageSections) {
    setSections((s) => {
      const next = fn(s);
      if (next !== s) {
        setSaveState("dirty");
        scheduleSave();
      }
      return next;
    });
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    const saved = await flushSave();
    if (!saved) {
      setPublishing(false);
      return;
    }
    const result = await publishHomepageAction(revisionId);
    setPublishing(false);
    if (!result.ok) {
      setPublishError(result.error);
      return;
    }
    setJustPublished(true);
    router.refresh();
  }

  const selected = sections.find((s) => s.id === selectedId) ?? null;
  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : saveState === "dirty" ? "Unsaved changes…" : saveState === "saved" ? "Draft saved" : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {saveState === "saving" && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted" aria-hidden="true" />}
          {saveState === "saved" && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-leaf" />}
          {saveState === "error" && <AlertTriangle className="size-3.5 shrink-0 text-danger" aria-hidden="true" />}
          <span className={cn(saveState === "error" ? "text-danger" : "text-muted")} role="status" aria-live="polite">
            {saveLabel}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/admin/homepage/preview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-full border border-line bg-raised px-3 text-[13px] font-semibold text-frost transition-colors duration-200 hover:bg-[#1d3527]"
          >
            <Eye className="size-4" aria-hidden="true" /> Preview
          </a>
          <Button type="button" size="sm" disabled={publishing} onClick={() => void handlePublish()}>
            {publishing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      {saveState === "error" && saveError && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Not saved: {saveError} Your edits are still here — fix the problem above and they&apos;ll save automatically.
        </p>
      )}
      {publishError && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {publishError}
        </p>
      )}
      {justPublished && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-leaf/30 bg-leaf/5 p-3 text-sm text-leaf">
          <Check className="size-4 shrink-0" aria-hidden="true" /> Published. The live homepage now shows this.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <SectionList
          sections={sections}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReorder={(from, to) => apply((s) => reorderSections(s, from, to))}
          onToggle={(id) => apply((s) => toggleSection(s, id))}
          onRemove={(id) => {
            if (id === selectedId) setSelectedId(null);
            apply((s) => removeSection(s, id));
          }}
          onAdd={(type: SectionType) => {
            const section = blankSection(type);
            apply((s) => addSection(s, section));
            setSelectedId(section.id);
          }}
        />
        <Inspector
          section={selected}
          onUpdate={(patch: Partial<Section>) => selected && apply((s) => updateSection(s, selected.id, patch))}
        />
      </div>
    </div>
  );
}
