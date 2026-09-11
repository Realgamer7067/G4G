import { describe, expect, it } from "vitest";
import { deriveEventStatus, registrationState, type StatusInput } from "./status";

const H = 3_600_000;
const now = new Date("2026-09-20T12:00:00Z");
const at = (hours: number) => new Date(now.getTime() + hours * H);

const base: StatusInput = {
  lifecycle: "PUBLISHED",
  startAt: at(48),
  endAt: at(56),
  registrationMode: "NONE",
  registrationDeadline: null,
  maxParticipants: null,
};

describe("deriveEventStatus", () => {
  it("reflects lifecycle first", () => {
    expect(deriveEventStatus({ ...base, lifecycle: "DRAFT" }, null, now)).toBe("DRAFT");
    expect(deriveEventStatus({ ...base, lifecycle: "ARCHIVED" }, null, now)).toBe("ARCHIVED");
    expect(deriveEventStatus({ ...base, lifecycle: "CANCELLED", startAt: at(-10), endAt: at(-5) }, null, now)).toBe("CANCELLED");
  });

  it("is completed after the end and ongoing between start and end", () => {
    expect(deriveEventStatus({ ...base, startAt: at(-10), endAt: at(-1) }, null, now)).toBe("COMPLETED");
    expect(deriveEventStatus({ ...base, startAt: at(-1), endAt: at(3) }, null, now)).toBe("ONGOING");
  });

  it("is simply upcoming when no registration is needed", () => {
    expect(deriveEventStatus(base, null, now)).toBe("UPCOMING");
  });

  it("opens external registration until the deadline, defaulting to the start time", () => {
    const external = { ...base, registrationMode: "EXTERNAL" as const };
    expect(deriveEventStatus(external, null, now)).toBe("REGISTRATION_OPEN");
    expect(deriveEventStatus({ ...external, registrationDeadline: at(-1) }, null, now)).toBe("REGISTRATION_CLOSED");
    expect(deriveEventStatus({ ...external, maxParticipants: 1 }, null, now)).toBe("REGISTRATION_OPEN");
  });

  it("closes form registration when full or not accepting", () => {
    const form = { ...base, registrationMode: "FORM" as const, maxParticipants: 100 };
    expect(deriveEventStatus(form, { count: 10, formAccepting: true }, now)).toBe("REGISTRATION_OPEN");
    expect(deriveEventStatus(form, { count: 100, formAccepting: true }, now)).toBe("REGISTRATION_CLOSED");
    expect(deriveEventStatus(form, { count: 0, formAccepting: false }, now)).toBe("REGISTRATION_CLOSED");
    expect(deriveEventStatus(form, null, now)).toBe("REGISTRATION_CLOSED");
  });
});

describe("registrationState", () => {
  it("reports why registration is closed and how many spots are left", () => {
    const form = { ...base, registrationMode: "FORM" as const, maxParticipants: 30 };
    expect(registrationState(form, { count: 12, formAccepting: true }, now)).toEqual({
      open: true, reason: "open", closesAt: base.startAt, spotsLeft: 18,
    });
    expect(registrationState(form, { count: 30, formAccepting: true }, now)).toMatchObject({ open: false, reason: "full", spotsLeft: 0 });
    expect(registrationState({ ...form, registrationDeadline: at(-2) }, { count: 0, formAccepting: true }, now)).toMatchObject({
      open: false, reason: "deadline_passed",
    });
    expect(registrationState(base, null, now)).toMatchObject({ open: false, reason: "not_required" });
    expect(registrationState({ ...form, lifecycle: "CANCELLED" }, { count: 0, formAccepting: true }, now)).toMatchObject({
      open: false, reason: "cancelled",
    });
  });

  it("allows on-the-spot registration when the deadline is after the start", () => {
    const external = { ...base, registrationMode: "EXTERNAL" as const, startAt: at(-1), endAt: at(4), registrationDeadline: at(2) };
    expect(registrationState(external, null, now)).toMatchObject({ open: true, reason: "open", spotsLeft: null });
    expect(deriveEventStatus(external, null, now)).toBe("ONGOING");
  });
});
