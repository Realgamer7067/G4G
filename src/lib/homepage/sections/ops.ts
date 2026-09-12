// src/lib/homepage/sections/ops.ts
import type { HomepageSections, Section } from "./schema";

function swap(arr: readonly Section[], i: number, j: number): Section[] {
  if (i < 0 || j < 0 || i >= arr.length || j >= arr.length) return [...arr];
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function addSection(sections: HomepageSections, section: Section, afterId: string | null = null): HomepageSections {
  const next = [...sections];
  const at = afterId ? next.findIndex((s) => s.id === afterId) : next.length - 1;
  next.splice(at + 1, 0, section);
  return next;
}

export function removeSection(sections: HomepageSections, id: string): HomepageSections {
  return sections.filter((s) => s.id !== id);
}

export function moveSection(sections: HomepageSections, id: string, dir: -1 | 1): HomepageSections {
  const idx = sections.findIndex((s) => s.id === id);
  if (idx === -1) return sections;
  return swap(sections, idx, idx + dir);
}

/** Reorders to an arbitrary new index — used by the dnd-kit drop handler, which already knows both indexes. */
export function reorderSections(sections: HomepageSections, fromIndex: number, toIndex: number): HomepageSections {
  if (fromIndex < 0 || fromIndex >= sections.length || toIndex < 0 || toIndex >= sections.length) return sections;
  const next = [...sections];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function toggleSection(sections: HomepageSections, id: string): HomepageSections {
  return sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
}

/**
 * Merges a patch into one section: top-level fields (anchorId, overrides) replace; `content` shallow-merges.
 * Not generic over the section's specific type — matches `updateBlock` in `forms/builder/ops.ts`, which takes
 * `Partial<Block>` (the whole union) rather than a per-kind generic, for the same reason: callers already know
 * which branch they're on and pass a same-shaped literal, so a generic here would only fight type inference
 * (Omit/Pick over a discriminated union collapses `content` to the union of every branch's content type,
 * which doesn't help the caller and isn't worth the complexity).
 */
export function updateSection(sections: HomepageSections, id: string, patch: Partial<Omit<Section, "id" | "type">>): HomepageSections {
  return sections.map((s) => {
    if (s.id !== id) return s;
    const { content, ...rest } = patch as { content?: Record<string, unknown> } & Record<string, unknown>;
    return { ...s, ...rest, content: content ? { ...s.content, ...content } : s.content } as Section;
  });
}
