import { describe, expect, it } from "vitest";
import { adminChangeProblem, beyondActorMessage, canAssignRole, permissionsBeyondActor, roleDeleteProblem } from "./policies";

describe("permissionsBeyondActor", () => {
  const manager = { roleKey: "event_manager", permissions: new Set(["events.create", "events.edit"]) };
  it("lists what the actor cannot hand out", () => {
    expect(permissionsBeyondActor(manager, ["events.edit", "settings.manage", "admins.manage", "settings.manage"])).toEqual([
      "admins.manage",
      "settings.manage",
    ]);
  });
  it("allows anything for super admins", () => {
    expect(permissionsBeyondActor({ roleKey: "super_admin", permissions: new Set() }, ["admins.manage"])).toEqual([]);
  });
  it("words the error", () => {
    expect(beyondActorMessage(["admins.manage"])).toBe("You can only grant permissions you have yourself. Not allowed: admins.manage.");
  });
});

const superActor = { id: "a1", roleKey: "super_admin" };
const managerActor = { id: "a2", roleKey: "event_manager" };
const superTarget = { id: "t1", roleKey: "super_admin", isActive: true };
const normalTarget = { id: "t2", roleKey: "team_manager", isActive: true };

describe("canAssignRole", () => {
  it("lets only super admins grant Super Admin", () => {
    expect(canAssignRole(superActor, "super_admin")).toBe(true);
    expect(canAssignRole(managerActor, "super_admin")).toBe(false);
    expect(canAssignRole(managerActor, "team_manager")).toBe(true);
  });
});

describe("adminChangeProblem", () => {
  it("blocks changing your own access", () => {
    expect(
      adminChangeProblem({ actor: superActor, target: { ...superTarget, id: "a1" }, activeSuperAdmins: 3, change: { kind: "deactivate" } }),
    ).toBe("You can't change your own access. Ask another admin.");
  });

  it("stops non-super admins from touching super admins", () => {
    expect(
      adminChangeProblem({ actor: managerActor, target: superTarget, activeSuperAdmins: 3, change: { kind: "deactivate" } }),
    ).toBe("Only a super admin can change another super admin.");
  });

  it("stops non-super admins from granting Super Admin", () => {
    expect(
      adminChangeProblem({
        actor: managerActor, target: normalTarget, activeSuperAdmins: 3, change: { kind: "role", newRoleKey: "super_admin" },
      }),
    ).toBe("Only a super admin can grant Super Admin.");
  });

  it("keeps at least one active super admin", () => {
    expect(
      adminChangeProblem({ actor: superActor, target: superTarget, activeSuperAdmins: 1, change: { kind: "deactivate" } }),
    ).toBe("Keep at least one active super admin.");
    expect(
      adminChangeProblem({
        actor: superActor, target: superTarget, activeSuperAdmins: 1, change: { kind: "role", newRoleKey: "event_manager" },
      }),
    ).toBe("Keep at least one active super admin.");
  });

  it("explains that super admins cannot be restricted", () => {
    expect(
      adminChangeProblem({ actor: superActor, target: superTarget, activeSuperAdmins: 2, change: { kind: "overrides" } }),
    ).toBe("Super admins always have every permission.");
  });

  it("allows ordinary changes", () => {
    expect(
      adminChangeProblem({ actor: superActor, target: superTarget, activeSuperAdmins: 2, change: { kind: "deactivate" } }),
    ).toBeNull();
    expect(
      adminChangeProblem({ actor: managerActor, target: normalTarget, activeSuperAdmins: 1, change: { kind: "overrides" } }),
    ).toBeNull();
    expect(
      adminChangeProblem({ actor: managerActor, target: { ...normalTarget, isActive: false }, activeSuperAdmins: 1, change: { kind: "activate" } }),
    ).toBeNull();
  });
});

describe("roleDeleteProblem", () => {
  it("protects the system role", () => {
    expect(roleDeleteProblem({ isSystem: true, memberCount: 0, pendingInvites: 0 })).toBe("The Super Admin role can't be deleted.");
  });
  it("requires moving members first", () => {
    expect(roleDeleteProblem({ isSystem: false, memberCount: 3, pendingInvites: 0 })).toBe("Move its 3 members to another role first.");
    expect(roleDeleteProblem({ isSystem: false, memberCount: 1, pendingInvites: 0 })).toBe("Move its 1 member to another role first.");
  });
  it("requires revoking invites first", () => {
    expect(roleDeleteProblem({ isSystem: false, memberCount: 0, pendingInvites: 2 })).toBe("Revoke its pending invites first.");
  });
  it("allows deleting an unused role", () => {
    expect(roleDeleteProblem({ isSystem: false, memberCount: 0, pendingInvites: 0 })).toBeNull();
  });
});
