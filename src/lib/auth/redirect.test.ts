import { describe, expect, it } from "vitest";
import { safeAdminRedirect } from "./redirect";

describe("safeAdminRedirect", () => {
  it.each([
    ["/admin", "/admin"],
    ["/admin/account", "/admin/account"],
    ["/admin?tab=1", "/admin?tab=1"],
  ])("keeps %s", (input, expected) => expect(safeAdminRedirect(input)).toBe(expected));
  it.each([
    ["https://evil.test/admin"], ["//evil.test"], ["/adminx"], ["/admin/login"], ["/\\evil"], [null], [""], ["/events"],
  ])("replaces %s with /admin", (input) => expect(safeAdminRedirect(input)).toBe("/admin"));
});
