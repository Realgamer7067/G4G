import { describe, expect, it } from "vitest";
import { canTransition, transitionAction } from "./lifecycle";

describe("event lifecycle", () => {
  it("allows the documented transitions", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransition("PUBLISHED", "DRAFT")).toBe(true);
    expect(canTransition("PUBLISHED", "CANCELLED")).toBe(true);
    expect(canTransition("CANCELLED", "PUBLISHED")).toBe(true);
    expect(canTransition("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransition("ARCHIVED", "DRAFT")).toBe(true);
  });
  it("blocks the rest", () => {
    expect(canTransition("DRAFT", "CANCELLED")).toBe(false);
    expect(canTransition("ARCHIVED", "PUBLISHED")).toBe(false);
    expect(canTransition("DRAFT", "DRAFT")).toBe(false);
  });
  it("names each transition for the audit log", () => {
    expect(transitionAction("DRAFT", "PUBLISHED")).toBe("event.published");
    expect(transitionAction("PUBLISHED", "DRAFT")).toBe("event.unpublished");
    expect(transitionAction("CANCELLED", "PUBLISHED")).toBe("event.reinstated");
    expect(transitionAction("ARCHIVED", "DRAFT")).toBe("event.restored");
    expect(transitionAction("PUBLISHED", "ARCHIVED")).toBe("event.archived");
  });
});
