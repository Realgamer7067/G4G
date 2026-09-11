export type Lifecycle = "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";

const TRANSITIONS: Record<Lifecycle, readonly Lifecycle[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["DRAFT", "CANCELLED", "ARCHIVED"],
  CANCELLED: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export function canTransition(from: Lifecycle, to: Lifecycle): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: Lifecycle): readonly Lifecycle[] {
  return TRANSITIONS[from];
}

export function transitionAction(from: Lifecycle, to: Lifecycle): string {
  if (to === "PUBLISHED") return from === "CANCELLED" ? "event.reinstated" : "event.published";
  if (to === "DRAFT") return from === "ARCHIVED" ? "event.restored" : "event.unpublished";
  if (to === "CANCELLED") return "event.cancelled";
  return "event.archived";
}

/** Button copy for the admin editor. */
export const TRANSITION_COPY: Record<string, { label: string; confirm: string; hint: string }> = {
  "DRAFT>PUBLISHED": { label: "Publish", confirm: "Publish now", hint: "Makes the event visible on the website." },
  "DRAFT>ARCHIVED": { label: "Archive", confirm: "Archive draft", hint: "Hides the draft from the main list." },
  "PUBLISHED>DRAFT": { label: "Unpublish", confirm: "Unpublish", hint: "Takes the event off the website; nothing is deleted." },
  "PUBLISHED>CANCELLED": { label: "Mark cancelled", confirm: "Cancel event", hint: "Keeps the page up with a Cancelled label and closes registration." },
  "PUBLISHED>ARCHIVED": { label: "Archive", confirm: "Archive event", hint: "Removes it from the website and lists. Restore any time." },
  "CANCELLED>PUBLISHED": { label: "Reinstate", confirm: "Reinstate event", hint: "Removes the Cancelled label." },
  "CANCELLED>ARCHIVED": { label: "Archive", confirm: "Archive event", hint: "Removes it from the website and lists." },
  "ARCHIVED>DRAFT": { label: "Restore as draft", confirm: "Restore", hint: "Brings it back as a draft you can publish again." },
};
