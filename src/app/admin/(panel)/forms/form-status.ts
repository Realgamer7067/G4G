export type FormStatus = "draft" | "live" | "changes" | "closed";

export function formStatus(f: { publishedVersionId: string | null; hasUnpublishedChanges: boolean; acceptingResponses: boolean; closesAt: Date | null }, now: Date = new Date()): FormStatus {
  if (!f.publishedVersionId) return "draft";
  if (!f.acceptingResponses || (f.closesAt && f.closesAt <= now)) return "closed";
  if (f.hasUnpublishedChanges) return "changes";
  return "live";
}

export const FORM_STATUS_META: Record<FormStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-dashed border-line text-muted" },
  live: { label: "Live", className: "border-leaf/30 bg-leaf/10 text-leaf" },
  changes: { label: "Unpublished changes", className: "border-amber/30 bg-amber/10 text-amber" },
  closed: { label: "Closed", className: "border-line bg-night/40 text-muted" },
};
