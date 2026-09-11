import { newId } from "../defaults";
import type { Block, Branch, Condition, ConditionGroup, Field, FormDefinition, Option, Page } from "../engine/schema";

function swap<T>(arr: readonly T[], i: number, j: number): T[] {
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return [...arr];
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function mapPage(def: FormDefinition, pageId: string, fn: (p: Page) => Page): FormDefinition {
  return { pages: def.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

function mapBlock(page: Page, blockId: string, fn: (b: Block) => Block): Page {
  return { ...page, blocks: page.blocks.map((b) => (b.id === blockId ? fn(b) : b)) };
}

// ---------------------------------------------------------------------------
// Reference cleanup: removing a question or option must not leave a condition
// pointing at something that no longer exists. `mapGroup` rewrites (or drops)
// individual conditions; `cleanupReferences` applies that everywhere a
// ConditionGroup can appear. A block/option `visibleWhen` that empties out
// becomes `undefined` ("always shown" — matches `evalGroup`'s treatment of no
// group). A branch's `when` is required by the schema, so a branch that would
// end up with zero conditions is dropped entirely rather than silently
// becoming an unconditional "always jump", which would swallow every branch
// after it.
// ---------------------------------------------------------------------------

function mapGroup(group: ConditionGroup | undefined, fn: (c: Condition) => Condition | null): ConditionGroup | undefined {
  if (!group) return undefined;
  const conditions = group.conditions.map(fn).filter((c): c is Condition => c !== null);
  return conditions.length ? { ...group, conditions } : undefined;
}

function cleanupReferences(def: FormDefinition, fn: (c: Condition) => Condition | null): FormDefinition {
  return {
    pages: def.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        const visibleWhen = mapGroup(block.visibleWhen, fn);
        if (block.kind === "field" && block.options) {
          return { ...block, visibleWhen, options: block.options.map((o) => ({ ...o, visibleWhen: mapGroup(o.visibleWhen, fn) })) };
        }
        return { ...block, visibleWhen };
      }),
      branches: page.branches.flatMap((br) => {
        const when = mapGroup(br.when, fn);
        return when ? [{ ...br, when }] : [];
      }),
    })),
  };
}

/** Drops every condition that refers to `fieldId` (used before removing a question). */
function dropFieldReferences(def: FormDefinition, fieldId: string): FormDefinition {
  return cleanupReferences(def, (c) => (c.fieldId === fieldId ? null : c));
}

/** Removes `optionId` from any condition value that lists it; drops the condition if that empties its value. */
function dropOptionReferences(def: FormDefinition, optionId: string): FormDefinition {
  return cleanupReferences(def, (c) => {
    if (c.value === undefined) return c;
    if (Array.isArray(c.value)) {
      if (!c.value.includes(optionId)) return c;
      const value = c.value.filter((v) => v !== optionId);
      return value.length ? { ...c, value } : null;
    }
    return String(c.value) === optionId ? null : c;
  });
}

/** Retargets jumps that point at a removed page back to "next" (falls through to the following page). */
function dropPageReferences(def: FormDefinition, pageId: string): FormDefinition {
  const fix = (target: string) => (target === pageId ? "next" : target);
  return {
    pages: def.pages.map((page) => ({
      ...page,
      defaultNext: fix(page.defaultNext),
      branches: page.branches.map((br) => ({ ...br, goTo: fix(br.goTo) })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export function addPage(def: FormDefinition, page: Page, afterPageId: string | null = null): FormDefinition {
  const pages = [...def.pages];
  const at = afterPageId ? pages.findIndex((p) => p.id === afterPageId) : pages.length - 1;
  pages.splice(at + 1, 0, page);
  return { pages };
}

export function removePage(def: FormDefinition, pageId: string): FormDefinition {
  if (def.pages.length <= 1) return def;
  const cleaned = dropPageReferences(def, pageId);
  return { pages: cleaned.pages.filter((p) => p.id !== pageId) };
}

/**
 * Clones a page. Blocks and options get fresh ids; conditions inside the page that reference a
 * field *on that same page* are rewritten to the new ids so the copy behaves like the original.
 * Conditions referencing an earlier page are untouched — that page wasn't duplicated, so the
 * reference is still valid. Branch targets (page ids) are kept as-is: since the copy is inserted
 * directly after the source, everything the source could jump to is still later than the copy.
 */
export function duplicatePage(def: FormDefinition, pageId: string): FormDefinition {
  const idx = def.pages.findIndex((p) => p.id === pageId);
  if (idx === -1) return def;
  const src = def.pages[idx];

  const blockIdMap = new Map<string, string>();
  const optionIdMaps = new Map<string, Map<string, string>>();

  const blocks: Block[] = src.blocks.map((b) => {
    const newBlockId = newId(b.kind === "field" ? "q" : "c");
    blockIdMap.set(b.id, newBlockId);
    if (b.kind === "field" && b.options) {
      const optMap = new Map<string, string>();
      const options = b.options.map((o) => {
        const newOptId = newId("opt");
        optMap.set(o.id, newOptId);
        return { ...o, id: newOptId };
      });
      optionIdMaps.set(b.id, optMap);
      return { ...b, id: newBlockId, options };
    }
    return { ...b, id: newBlockId };
  });

  const remapCondition = (c: Condition): Condition => {
    const newFieldId = blockIdMap.get(c.fieldId);
    if (!newFieldId) return c;
    const optMap = optionIdMaps.get(c.fieldId);
    if (!optMap || c.value === undefined) return { ...c, fieldId: newFieldId };
    const value = Array.isArray(c.value) ? c.value.map((v) => optMap.get(v) ?? v) : (optMap.get(String(c.value)) ?? c.value);
    return { ...c, fieldId: newFieldId, value };
  };
  const remapGroup = (g: ConditionGroup | undefined) => (g ? { ...g, conditions: g.conditions.map(remapCondition) } : undefined);

  const remappedBlocks = blocks.map((b) => {
    const visibleWhen = remapGroup(b.visibleWhen);
    if (b.kind === "field" && b.options) return { ...b, visibleWhen, options: b.options.map((o) => ({ ...o, visibleWhen: remapGroup(o.visibleWhen) })) };
    return { ...b, visibleWhen };
  });

  const newPage: Page = {
    ...src,
    id: newId("page"),
    title: src.title ? `${src.title} (copy)` : src.title,
    blocks: remappedBlocks,
    branches: src.branches.map((br) => ({ ...br, id: newId("branch"), when: remapGroup(br.when)! })),
  };

  const pages = [...def.pages];
  pages.splice(idx + 1, 0, newPage);
  return { pages };
}

export function movePage(def: FormDefinition, pageId: string, dir: -1 | 1): FormDefinition {
  const idx = def.pages.findIndex((p) => p.id === pageId);
  if (idx === -1) return def;
  return { pages: swap(def.pages, idx, idx + dir) };
}

export function updatePage(def: FormDefinition, pageId: string, patch: Partial<Pick<Page, "title" | "description" | "defaultNext">>): FormDefinition {
  return mapPage(def, pageId, (p) => ({ ...p, ...patch }));
}

// ---------------------------------------------------------------------------
// Blocks (questions and content)
// ---------------------------------------------------------------------------

export function addBlock(def: FormDefinition, pageId: string, block: Block, afterBlockId: string | null = null): FormDefinition {
  return mapPage(def, pageId, (page) => {
    const blocks = [...page.blocks];
    const at = afterBlockId ? blocks.findIndex((b) => b.id === afterBlockId) : blocks.length - 1;
    blocks.splice(at + 1, 0, block);
    return { ...page, blocks };
  });
}

export function removeBlock(def: FormDefinition, pageId: string, blockId: string): FormDefinition {
  const cleaned = dropFieldReferences(def, blockId);
  return mapPage(cleaned, pageId, (page) => ({ ...page, blocks: page.blocks.filter((b) => b.id !== blockId) }));
}

/**
 * Clones a question or content block. No condition remapping is needed: a block's own
 * `visibleWhen` (and its options' `visibleWhen`) can only reference *earlier* fields — never
 * itself or its siblings — so nothing in the copy or elsewhere in the form points at it yet.
 */
export function duplicateBlock(def: FormDefinition, pageId: string, blockId: string): FormDefinition {
  return mapPage(def, pageId, (page) => {
    const idx = page.blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return page;
    const src = page.blocks[idx];
    const clone: Block =
      src.kind === "field" ? { ...src, id: newId("q"), options: src.options?.map((o) => ({ ...o, id: newId("opt") })) } : { ...src, id: newId("c") };
    const blocks = [...page.blocks];
    blocks.splice(idx + 1, 0, clone);
    return { ...page, blocks };
  });
}

export function moveBlock(def: FormDefinition, pageId: string, blockId: string, dir: -1 | 1): FormDefinition {
  return mapPage(def, pageId, (page) => {
    const idx = page.blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return page;
    return { ...page, blocks: swap(page.blocks, idx, idx + dir) };
  });
}

export function updateBlock(def: FormDefinition, pageId: string, blockId: string, patch: Partial<Block>): FormDefinition {
  return mapPage(def, pageId, (page) => mapBlock(page, blockId, (b) => ({ ...b, ...patch }) as Block));
}

// ---------------------------------------------------------------------------
// Options (choice fields)
// ---------------------------------------------------------------------------

export function addOption(def: FormDefinition, pageId: string, blockId: string, option: Option): FormDefinition {
  return mapPage(def, pageId, (page) =>
    mapBlock(page, blockId, (b) => (b.kind === "field" ? { ...b, options: [...(b.options ?? []), option] } : b)),
  );
}

export function removeOption(def: FormDefinition, pageId: string, blockId: string, optionId: string): FormDefinition {
  const cleaned = dropOptionReferences(def, optionId);
  return mapPage(cleaned, pageId, (page) =>
    mapBlock(page, blockId, (b) => (b.kind === "field" ? { ...b, options: (b.options ?? []).filter((o) => o.id !== optionId) } : b)),
  );
}

/** Clones an option. Its `visibleWhen` can only reference earlier fields (never a sibling option), so no remap is needed. */
export function duplicateOption(def: FormDefinition, pageId: string, blockId: string, optionId: string): FormDefinition {
  return mapPage(def, pageId, (page) =>
    mapBlock(page, blockId, (b) => {
      if (b.kind !== "field" || !b.options) return b;
      const idx = b.options.findIndex((o) => o.id === optionId);
      if (idx === -1) return b;
      const options = [...b.options];
      options.splice(idx + 1, 0, { ...options[idx], id: newId("opt") });
      return { ...b, options };
    }),
  );
}

export function moveOption(def: FormDefinition, pageId: string, blockId: string, optionId: string, dir: -1 | 1): FormDefinition {
  return mapPage(def, pageId, (page) =>
    mapBlock(page, blockId, (b) => {
      if (b.kind !== "field" || !b.options) return b;
      const idx = b.options.findIndex((o) => o.id === optionId);
      if (idx === -1) return b;
      return { ...b, options: swap(b.options, idx, idx + dir) };
    }),
  );
}

export function updateOption(def: FormDefinition, pageId: string, blockId: string, optionId: string, patch: Partial<Option>): FormDefinition {
  return mapPage(def, pageId, (page) =>
    mapBlock(page, blockId, (b) => (b.kind === "field" && b.options ? { ...b, options: b.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) } : b)),
  );
}

// ---------------------------------------------------------------------------
// Branches (page-level jump rules)
// ---------------------------------------------------------------------------

export function addBranch(def: FormDefinition, pageId: string, branch: Branch): FormDefinition {
  return mapPage(def, pageId, (page) => ({ ...page, branches: [...page.branches, branch] }));
}

export function removeBranch(def: FormDefinition, pageId: string, branchId: string): FormDefinition {
  return mapPage(def, pageId, (page) => ({ ...page, branches: page.branches.filter((b) => b.id !== branchId) }));
}

export function updateBranch(def: FormDefinition, pageId: string, branchId: string, patch: Partial<Branch>): FormDefinition {
  return mapPage(def, pageId, (page) => ({ ...page, branches: page.branches.map((b) => (b.id === branchId ? { ...b, ...patch } : b)) }));
}

export function moveBranch(def: FormDefinition, pageId: string, branchId: string, dir: -1 | 1): FormDefinition {
  return mapPage(def, pageId, (page) => {
    const idx = page.branches.findIndex((b) => b.id === branchId);
    if (idx === -1) return page;
    return { ...page, branches: swap(page.branches, idx, idx + dir) };
  });
}

// ---------------------------------------------------------------------------
// Selectors for the inspector: which fields/pages a rule is allowed to reference.
// Mirrors validateDefinition's "earlier" rule exactly so the picker can never offer
// something publishing would then reject.
// ---------------------------------------------------------------------------

/** Fields strictly before `blockId` (earlier pages in full, earlier blocks on the same page). */
export function earlierFields(def: FormDefinition, blockId: string): Field[] {
  const fields: Field[] = [];
  for (const page of def.pages) {
    for (const block of page.blocks) {
      if (block.id === blockId) return fields;
      if (block.kind === "field") fields.push(block);
    }
  }
  return fields;
}

/** Every field on `pageId` and all earlier pages — what a branch on that page may reference. */
export function fieldsThroughPage(def: FormDefinition, pageId: string): Field[] {
  const fields: Field[] = [];
  for (const page of def.pages) {
    for (const block of page.blocks) if (block.kind === "field") fields.push(block);
    if (page.id === pageId) return fields;
  }
  return fields;
}

/** Pages a jump from `pageId` may target (later pages only — jumps never go backward). */
export function laterPages(def: FormDefinition, pageId: string): Page[] {
  const idx = def.pages.findIndex((p) => p.id === pageId);
  return idx === -1 ? [] : def.pages.slice(idx + 1);
}
