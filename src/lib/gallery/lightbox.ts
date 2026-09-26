/** Wraps a lightbox index by delta (+1 / -1) around [0, length). Returns 0 for length <= 0. */
export function wrapIndex(index: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}
