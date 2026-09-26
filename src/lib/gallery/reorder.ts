/** Moves the id at fromIndex to toIndex, same shape as dnd-kit's onDragEnd gives you. Used for both album and image ordering — order is always "array index". */
export function reorderIds(ids: readonly string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
