import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

vi.mock("next/headers", () => import("@/test/mocks/next-headers"));
vi.mock("next/cache", () => import("@/test/mocks/next-cache"));

const { POST } = await import("./route");

const BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

function beacon(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json", "user-agent": BROWSER, "x-real-ip": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(async () => {
  await db.dailyPageView.deleteMany();
});

describe("POST /api/v", () => {
  it("counts views per normalized path and day", async () => {
    expect((await POST(beacon({ path: "/events/git-workshop?utm=1" }))).status).toBe(204);
    expect((await POST(beacon({ path: "/events/git-workshop/" }))).status).toBe(204);
    expect((await POST(beacon({ path: "/" }))).status).toBe(204);
    const rows = await db.dailyPageView.findMany({ orderBy: { path: "asc" } });
    expect(rows.map((r) => [r.path, r.views])).toEqual([
      ["/", 1],
      ["/events/git-workshop", 2],
    ]);
  });

  it("rejects cross-origin and malformed requests without writing", async () => {
    expect((await POST(beacon({ path: "/" }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await POST(beacon("not json"))).status).toBe(400);
    expect((await POST(beacon({ path: "/admin/users" }))).status).toBe(400);
    expect(await db.dailyPageView.count()).toBe(0);
  });

  it("ignores bots silently", async () => {
    expect((await POST(beacon({ path: "/" }, { "user-agent": "Googlebot/2.1" }))).status).toBe(204);
    expect(await db.dailyPageView.count()).toBe(0);
  });
});
