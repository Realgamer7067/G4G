// src/lib/team/schema.test.ts
import { describe, expect, it } from "vitest";
import {
  groupByDomain,
  groupByTier,
  reorderIds,
  teamDomainSchema,
  teamLinksSchema,
  teamMemberLinkList,
  teamMemberSchema,
  teamTermSchema,
  type TeamMemberDTO,
} from "./schema";

describe("teamTermSchema", () => {
  it("accepts a valid term and coerces the year to a number", () => {
    const result = teamTermSchema.safeParse({ label: "2026-27", startYear: "2026" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.startYear).toBe(2026);
  });

  it("rejects a year out of range", () => {
    expect(teamTermSchema.safeParse({ label: "x", startYear: "1900" }).success).toBe(false);
  });
});

describe("teamDomainSchema", () => {
  it("requires at least 2 characters", () => {
    expect(teamDomainSchema.safeParse({ name: "A" }).success).toBe(false);
  });
});

describe("teamLinksSchema", () => {
  it("rejects a non-https link", () => {
    expect(teamLinksSchema.safeParse({ linkedin: "javascript:alert(1)" }).success).toBe(false);
  });

  it("defaults every link to an empty string", () => {
    expect(teamLinksSchema.parse({})).toEqual({ linkedin: "", github: "", instagram: "", website: "", x: "" });
  });
});

describe("teamMemberSchema", () => {
  it("normalises an empty domainId to null and coerces order", () => {
    const result = teamMemberSchema.parse({ termId: "t1", name: "A", title: "Lead", tier: "LEAD", domainId: "", links: {}, order: "3" });
    expect(result.domainId).toBeNull();
    expect(result.order).toBe(3);
  });

  it("treats an absent checkbox as not featured", () => {
    const result = teamMemberSchema.parse({ termId: "t1", name: "A", title: "Lead", tier: "LEAD", links: {}, order: "0" });
    expect(result.featured).toBe(false);
  });
});

describe("reorderIds", () => {
  it("swaps with the next id", () => {
    expect(reorderIds(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });

  it("swaps with the previous id", () => {
    expect(reorderIds(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
  });

  it("returns null when moving the first id up", () => {
    expect(reorderIds(["a", "b"], "a", -1)).toBeNull();
  });

  it("returns null when moving the last id down", () => {
    expect(reorderIds(["a", "b"], "b", 1)).toBeNull();
  });

  it("returns null for an id that isn't in the list", () => {
    expect(reorderIds(["a", "b"], "z", 1)).toBeNull();
  });
});

function member(overrides: Partial<TeamMemberDTO>): TeamMemberDTO {
  return {
    id: "m1",
    name: "A",
    title: "Member",
    tier: "MEMBER",
    bio: "",
    featured: false,
    order: 0,
    links: { linkedin: "", github: "", instagram: "", website: "", x: "" },
    photo: null,
    domain: null,
    ...overrides,
  };
}

describe("groupByTier", () => {
  it("orders groups by tier priority and drops empty tiers", () => {
    const groups = groupByTier([member({ id: "1", tier: "MEMBER" }), member({ id: "2", tier: "LEAD" })]);
    expect(groups.map((g) => g.tier)).toEqual(["LEAD", "MEMBER"]);
  });

  it("sorts members within a tier by order then name", () => {
    const [group] = groupByTier([
      member({ id: "1", name: "Zed", order: 0, tier: "CORE" }),
      member({ id: "2", name: "Amy", order: 0, tier: "CORE" }),
    ]);
    expect(group.members.map((m) => m.name)).toEqual(["Amy", "Zed"]);
  });
});

describe("groupByDomain", () => {
  it("groups by domain order and puts domainless members in a trailing group", () => {
    const groups = groupByDomain([
      member({ id: "1", domain: { id: "d2", name: "Design", order: 1 } }),
      member({ id: "2", domain: null }),
      member({ id: "3", domain: { id: "d1", name: "Development", order: 0 } }),
    ]);
    expect(groups.map((g) => g.domain?.name ?? "other")).toEqual(["Development", "Design", "other"]);
  });
});

describe("teamMemberLinkList", () => {
  it("lists only the filled links in a fixed order", () => {
    const list = teamMemberLinkList({ linkedin: "https://linkedin.com/in/x", github: "", instagram: "", website: "https://x.dev", x: "" });
    expect(list.map((l) => l.key)).toEqual(["linkedin", "website"]);
    expect(list[1]).toMatchObject({ network: "custom", label: "Website" });
  });
});
