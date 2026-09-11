// Browser-safe URL helpers (no Node imports), shared by server and client components.

export function mediaUrl(storageKey: string, file: string): string {
  return `/media/${storageKey}/${file}`;
}
