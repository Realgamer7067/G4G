"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Eye, Loader2, X } from "lucide-react";
import type { ContentImage } from "@/components/forms/form-wizard";
import { FormWizard } from "@/components/forms/form-wizard";
import { Button } from "@/components/ui/button";
import { blankBranch, blankContent, blankField, blankOption, blankPage, type ContentType } from "@/lib/forms/builder/factories";
import {
  addBlock,
  addBranch,
  addOption,
  addPage,
  duplicateBlock,
  duplicateOption,
  duplicatePage,
  earlierFields,
  fieldsThroughPage,
  laterPages,
  moveBlock,
  moveOption,
  movePage,
  removeBlock,
  removeBranch,
  removeOption,
  removePage,
  updateBlock,
  updateBranch,
  updateOption,
  updatePage,
} from "@/lib/forms/builder/ops";
import { allFields, type Block, type FieldType, type FormDefinition, type Page } from "@/lib/forms/engine/schema";
import { validateDefinition, type DefinitionIssue } from "@/lib/forms/engine/validate-definition";
import { publishFormAction, resolvePreviewImagesAction, saveFormDraftAction } from "@/server/actions/forms";
import { cn } from "@/lib/utils/cn";
import { BlockCanvas } from "./block-canvas";
import { Inspector } from "./inspector";
import { PagesRail } from "./pages-rail";

export type BuilderPreviewMeta = {
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  reviewStep: boolean;
  cover: { id: string; url: string; alt: string } | null;
  images: Record<string, ContentImage>;
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function FormBuilder({
  formId,
  slug,
  initialDefinition,
  justCreated,
  justDuplicated,
  preview,
}: {
  formId: string;
  slug: string;
  initialDefinition: FormDefinition;
  justCreated: boolean;
  justDuplicated: boolean;
  preview: BuilderPreviewMeta;
}) {
  const router = useRouter();
  const [definition, setDefinition] = useState(initialDefinition);
  const [selectedPageId, setSelectedPageId] = useState(initialDefinition.pages[0].id);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [justPublished, setJustPublished] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [images, setImages] = useState<Record<string, ContentImage>>(preview.images);

  const definitionRef = useRef(definition);
  useEffect(() => {
    definitionRef.current = definition;
  }, [definition]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  // Serializes autosaves: at most one request in flight. If more edits land while a save is out,
  // it loops and saves again with the latest definition once the first request returns — so Publish
  // (which awaits this same promise) always sees exactly what's on screen persisted before it reads
  // the row back out.
  const flushSave = useCallback((): Promise<boolean> => {
    if (savePromiseRef.current) return savePromiseRef.current;
    const run = async (): Promise<boolean> => {
      let toSave = definitionRef.current;
      for (;;) {
        setSaveState("saving");
        const result = await saveFormDraftAction(formId, toSave);
        if (!result.ok) {
          savePromiseRef.current = null;
          setSaveState("error");
          setSaveError(result.error);
          return false;
        }
        setSaveError(null);
        if (definitionRef.current === toSave) {
          savePromiseRef.current = null;
          setSaveState("saved");
          return true;
        }
        toSave = definitionRef.current;
      }
    };
    const p = run();
    savePromiseRef.current = p;
    return p;
  }, [formId]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushSave(), 800);
  }, [flushSave]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Warn before leaving with edits not yet confirmed saved. Not shown on "idle" (nothing touched yet)
  // or plain "saved" (fully persisted).
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

  function apply(fn: (d: FormDefinition) => FormDefinition) {
    setDefinition((d) => {
      const next = fn(d);
      if (next !== d) {
        setSaveState("dirty");
        scheduleSave();
      }
      return next;
    });
  }

  const issues = useMemo<DefinitionIssue[]>(() => {
    const r = validateDefinition(definition);
    return r.ok ? [] : r.issues;
  }, [definition]);

  const fieldsById = useMemo(() => new Map(allFields(definition).map((f) => [f.id, f])), [definition]);

  const pageIndex = definition.pages.findIndex((p) => p.id === selectedPageId);
  const page: Page = definition.pages[pageIndex] ?? definition.pages[0];
  const activePageId = page.id;
  const block = selectedBlockId ? (page.blocks.find((b) => b.id === selectedBlockId) ?? null) : null;

  // Refetch content-image URLs only when the *set* of referenced upload ids changes, not on every
  // keystroke. `definitionRef` (not `definition`) is read inside so this doesn't need it as a dependency.
  const imageIdsKey = useMemo(() => {
    const ids = new Set<string>();
    for (const p of definition.pages) for (const b of p.blocks) if (b.kind === "content" && b.type === "image" && b.uploadId) ids.add(b.uploadId);
    return [...ids].sort().join(",");
  }, [definition]);
  useEffect(() => {
    let cancelled = false;
    resolvePreviewImagesAction(definitionRef.current)
      .then((imgs) => {
        if (!cancelled) setImages(imgs);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [imageIdsKey]);

  function selectPage(id: string) {
    setSelectedPageId(id);
    setSelectedBlockId(null);
  }

  async function handlePublish() {
    if (issues.length > 0) return;
    setPublishing(true);
    setPublishError(null);
    const saved = await flushSave();
    if (!saved) {
      setPublishing(false);
      return;
    }
    const result = await publishFormAction(formId);
    setPublishing(false);
    if (!result.ok) {
      setPublishError(result.error);
      return;
    }
    setJustPublished(true);
    router.refresh();
  }

  function jumpToIssue(path: string) {
    const m = /^pages\.(\d+)(?:\.blocks\.(\d+))?/.exec(path);
    if (!m) return;
    const pIdx = Number(m[1]);
    const target = definition.pages[pIdx];
    if (!target) return;
    setSelectedPageId(target.id);
    const bIdx = m[2] !== undefined ? Number(m[2]) : undefined;
    setSelectedBlockId(bIdx !== undefined ? (target.blocks[bIdx]?.id ?? null) : null);
  }

  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : saveState === "dirty" ? "Unsaved changes…" : saveState === "saved" ? "Draft saved" : null;

  return (
    <div className="grid gap-4">
      {(justCreated || justDuplicated) && !dismissedBanner && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-leaf/30 bg-leaf/5 px-4 py-2.5 text-sm text-leaf">
          <span>{justCreated ? "Form created. Add your questions below, then publish when ready." : "Form duplicated. Review the copy, then publish when ready."}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setDismissedBanner(true)} className="rounded-md p-1 hover:bg-leaf/10">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

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
          {issues.length > 0 && (
            <span className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-1 text-xs text-amber">
              {issues.length} issue{issues.length === 1 ? "" : "s"} to fix
            </span>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-4" aria-hidden="true" /> Preview
          </Button>
          <Button type="button" size="sm" disabled={publishing || issues.length > 0} onClick={() => void handlePublish()}>
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
          <Check className="size-4 shrink-0" aria-hidden="true" /> Published. Responses can now come in through this version.
        </p>
      )}

      {issues.length > 0 && (
        <div className="grid gap-1.5 rounded-2xl border border-amber/30 bg-amber/5 p-4">
          <p className="text-sm font-medium text-amber">Fix these before publishing:</p>
          <ul className="grid gap-1 text-sm">
            {issues.slice(0, 12).map((issue, i) => (
              <li key={i}>
                <button type="button" onClick={() => jumpToIssue(issue.path)} className="text-left text-amber/90 hover:underline">
                  {issue.message}
                </button>
              </li>
            ))}
            {issues.length > 12 && <li className="text-amber/70">…and {issues.length - 12} more.</li>}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr_340px]">
        <PagesRail
          pages={definition.pages}
          selectedPageId={activePageId}
          issues={issues}
          onSelect={selectPage}
          onAdd={() => {
            const p = blankPage(definition.pages.length + 1);
            apply((d) => addPage(d, p, activePageId));
            selectPage(p.id);
          }}
          onDuplicate={(id) => {
            const result = duplicatePage(definition, id);
            const idx = result.pages.findIndex((p) => p.id === id);
            const copy = result.pages[idx + 1];
            apply(() => result);
            if (copy) selectPage(copy.id);
          }}
          onRemove={(id) => {
            if (id === activePageId) {
              const idx = definition.pages.findIndex((p) => p.id === id);
              const fallback = definition.pages[idx - 1] ?? definition.pages[idx + 1];
              if (fallback) selectPage(fallback.id);
            }
            apply((d) => removePage(d, id));
          }}
          onMove={(id, dir) => apply((d) => movePage(d, id, dir))}
        />

        <BlockCanvas
          page={page}
          pageIndex={pageIndex === -1 ? 0 : pageIndex}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
          onUpdatePage={(patch) => apply((d) => updatePage(d, activePageId, patch))}
          onAddField={(type: FieldType) => {
            const f = blankField(type);
            apply((d) => addBlock(d, activePageId, f, selectedBlockId));
            setSelectedBlockId(f.id);
          }}
          onAddContent={(type: ContentType) => {
            const c = blankContent(type);
            apply((d) => addBlock(d, activePageId, c, selectedBlockId));
            setSelectedBlockId(c.id);
          }}
          onMoveBlock={(id, dir) => apply((d) => moveBlock(d, activePageId, id, dir))}
          onDuplicateBlock={(id) => {
            apply((d) => duplicateBlock(d, activePageId, id));
          }}
          onRemoveBlock={(id) => {
            if (id === selectedBlockId) setSelectedBlockId(null);
            apply((d) => removeBlock(d, activePageId, id));
          }}
          onAddBranch={(goTo) => apply((d) => addBranch(d, activePageId, blankBranch(goTo)))}
          onUpdateBranch={(id, patch) => apply((d) => updateBranch(d, activePageId, id, patch))}
          onRemoveBranch={(id) => apply((d) => removeBranch(d, activePageId, id))}
          fieldsById={fieldsById}
          fieldsThroughPage={fieldsThroughPage(definition, activePageId)}
          laterPages={laterPages(definition, activePageId)}
        />

        <Inspector
          block={block}
          earlier={block ? earlierFields(definition, block.id) : []}
          images={images}
          onUpdateBlock={(patch) => block && apply((d) => updateBlock(d, activePageId, block.id, patch as Partial<Block>))}
          onRemoveBlock={() => {
            if (block) {
              setSelectedBlockId(null);
              apply((d) => removeBlock(d, activePageId, block.id));
            }
          }}
          onDuplicateBlock={() => block && apply((d) => duplicateBlock(d, activePageId, block.id))}
          onAddOption={() => {
            if (!block || block.kind !== "field") return;
            const n = (block.options?.length ?? 0) + 1;
            apply((d) => addOption(d, activePageId, block.id, blankOption(n)));
          }}
          onUpdateOption={(optionId, patch) => block && apply((d) => updateOption(d, activePageId, block.id, optionId, patch))}
          onRemoveOption={(optionId) => block && apply((d) => removeOption(d, activePageId, block.id, optionId))}
          onDuplicateOption={(optionId) => block && apply((d) => duplicateOption(d, activePageId, block.id, optionId))}
          onMoveOption={(optionId, dir) => block && apply((d) => moveOption(d, activePageId, block.id, optionId, dir))}
        />
      </div>

      {previewOpen && (
        <div role="dialog" aria-modal="true" aria-label="Form preview" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-night/90 p-4 py-10 backdrop-blur-sm">
          <button type="button" aria-label="Close preview" onClick={() => setPreviewOpen(false)} className="fixed right-4 top-4 z-10 rounded-full bg-surface p-2 text-frost shadow-lg hover:bg-raised">
            <X className="size-5" aria-hidden="true" />
          </button>
          <FormWizard
            slug={slug}
            versionId={`preview-${formId}`}
            definition={definition}
            title={preview.title || "Untitled form"}
            description={preview.description}
            submitLabel={preview.submitLabel || "Submit"}
            successMessage={preview.successMessage}
            reviewStep={preview.reviewStep}
            cover={null}
            meta={[]}
            images={images}
            preview
          />
        </div>
      )}
    </div>
  );
}
