import { describe, expect, it } from "vitest";
import { writeAuditLog, type AuditClient } from "./audit";

function fakeClient() {
  const calls: unknown[] = [];
  const client = {
    auditLog: {
      create: async (args: unknown) => {
        calls.push(args);
        return {};
      },
    },
  } as unknown as AuditClient;
  return { client, calls };
}

describe("writeAuditLog", () => {
  it("records actor, target, metadata and request info", async () => {
    const { client, calls } = fakeClient();
    await writeAuditLog(client, {
      actor: { id: "u1", name: "Alex" },
      action: "event.publish",
      target: { type: "Event", id: "e1", label: "Code Sprint" },
      metadata: { from: "DRAFT" },
      meta: { ip: "1.2.3.4", userAgent: "UA" },
    });
    expect(calls).toEqual([
      {
        data: {
          actorId: "u1", actorName: "Alex", action: "event.publish", targetType: "Event", targetId: "e1",
          targetLabel: "Code Sprint", metadata: { from: "DRAFT" }, ip: "1.2.3.4", userAgent: "UA",
        },
      },
    ]);
  });
  it("labels system actions and fills defaults", async () => {
    const { client, calls } = fakeClient();
    await writeAuditLog(client, { actor: null, action: "auth.login_failed", target: { type: "AdminUser" } });
    expect(calls).toEqual([
      {
        data: {
          actorId: null, actorName: "System", action: "auth.login_failed", targetType: "AdminUser", targetId: null,
          targetLabel: "", metadata: {}, ip: null, userAgent: null,
        },
      },
    ]);
  });
});
