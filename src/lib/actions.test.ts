import { describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction } from "./actions";
import { ForbiddenError, UnauthorizedError, UserError } from "./errors";

describe("runAction", () => {
  it("wraps a successful result", async () => {
    expect(await runAction(async () => 42)).toEqual({ ok: true, data: 42 });
  });
  it("passes user errors through with field errors", async () => {
    const result = await runAction(async () => {
      throw new UserError("That slug is taken.", { slug: ["That slug is taken."] });
    });
    expect(result).toEqual({ ok: false, error: "That slug is taken.", fieldErrors: { slug: ["That slug is taken."] } });
  });
  it("maps zod errors to field errors", async () => {
    const result = await runAction(async () => z.object({ name: z.string().min(2) }).parse({ name: "a" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Check the highlighted fields.");
      expect(result.fieldErrors?.name?.length).toBe(1);
    }
  });
  it("keys nested zod errors by dotted path", async () => {
    const schema = z.object({ socials: z.object({ github: z.url() }), footer: z.object({ columns: z.array(z.object({ title: z.string().min(1) })) }) });
    const result = await runAction(async () => schema.parse({ socials: { github: "nope" }, footer: { columns: [{ title: "" }] } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["footer.columns.0.title", "socials.github"]);
  });
  it("maps permission errors", async () => {
    const result = await runAction(async () => {
      throw new ForbiddenError();
    });
    expect(result).toEqual({ ok: false, error: "You don't have permission to do that." });
  });
  it("maps missing sessions", async () => {
    const result = await runAction(async () => {
      throw new UnauthorizedError();
    });
    expect(result).toEqual({ ok: false, error: "Your session has ended. Sign in again." });
  });
  it("hides unexpected errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runAction(async () => {
      throw new Error("db exploded");
    });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Try again." });
    spy.mockRestore();
  });
  it("rethrows Next.js redirects", async () => {
    await expect(runAction(async () => redirect("/admin"))).rejects.toThrow();
  });
});
