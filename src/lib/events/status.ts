export type EventDisplayStatus =
  | "DRAFT"
  | "ARCHIVED"
  | "CANCELLED"
  | "COMPLETED"
  | "ONGOING"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "UPCOMING";

export type StatusInput = {
  lifecycle: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
  startAt: Date;
  endAt: Date;
  registrationMode: "NONE" | "FORM" | "EXTERNAL";
  registrationDeadline: Date | null;
  maxParticipants: number | null;
};

/** Registrations so far and whether the linked form accepts responses (FORM mode only). */
export type RegistrationStats = { count: number; formAccepting: boolean } | null;

export type RegistrationReason =
  | "not_required"
  | "open"
  | "deadline_passed"
  | "full"
  | "not_accepting"
  | "event_over"
  | "cancelled"
  | "draft";

export type RegistrationState = { open: boolean; reason: RegistrationReason; closesAt: Date | null; spotsLeft: number | null };

export function registrationState(e: StatusInput, stats: RegistrationStats, now: Date): RegistrationState {
  const closesAt = e.registrationMode === "NONE" ? null : (e.registrationDeadline ?? e.startAt);
  const spotsLeft = e.registrationMode === "FORM" && e.maxParticipants != null ? Math.max(0, e.maxParticipants - (stats?.count ?? 0)) : null;
  const closed = (reason: RegistrationReason): RegistrationState => ({ open: false, reason, closesAt, spotsLeft });

  if (e.registrationMode === "NONE") return closed("not_required");
  if (e.lifecycle === "CANCELLED") return closed("cancelled");
  if (e.lifecycle !== "PUBLISHED") return closed("draft");
  if (now >= e.endAt) return closed("event_over");
  if (closesAt && now >= closesAt) return closed("deadline_passed");
  if (e.registrationMode === "FORM") {
    if (!stats?.formAccepting) return closed("not_accepting");
    if (spotsLeft === 0) return closed("full");
  }
  return { open: true, reason: "open", closesAt, spotsLeft };
}

export function deriveEventStatus(e: StatusInput, stats: RegistrationStats, now: Date): EventDisplayStatus {
  if (e.lifecycle === "DRAFT") return "DRAFT";
  if (e.lifecycle === "ARCHIVED") return "ARCHIVED";
  if (e.lifecycle === "CANCELLED") return "CANCELLED";
  if (now >= e.endAt) return "COMPLETED";
  if (now >= e.startAt) return "ONGOING";
  if (e.registrationMode === "NONE") return "UPCOMING";
  return registrationState(e, stats, now).open ? "REGISTRATION_OPEN" : "REGISTRATION_CLOSED";
}

export const STATUS_META: Record<EventDisplayStatus, { label: string; tone: "leaf" | "mint" | "amber" | "danger" | "muted" | "draft" }> = {
  DRAFT: { label: "Draft", tone: "draft" },
  ARCHIVED: { label: "Archived", tone: "muted" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "muted" },
  ONGOING: { label: "Happening now", tone: "amber" },
  REGISTRATION_OPEN: { label: "Registration open", tone: "leaf" },
  REGISTRATION_CLOSED: { label: "Registration closed", tone: "muted" },
  UPCOMING: { label: "Upcoming", tone: "mint" },
};

export const REASON_COPY: Record<RegistrationReason, string> = {
  not_required: "No registration needed. Just show up.",
  open: "Registration is open.",
  deadline_passed: "Registration has closed.",
  full: "All seats are taken.",
  not_accepting: "Registration isn't open right now.",
  event_over: "This event has ended.",
  cancelled: "This event was cancelled.",
  draft: "Registration opens when the event is published.",
};
