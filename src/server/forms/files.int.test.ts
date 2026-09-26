import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { visibilityRoot } from "@/lib/media/storage";
import { CLAIM_WINDOW_MS, pruneUnclaimedFormFiles, saveFormFile } from "./files";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function stored(ageMs: number) {
  const upload = await saveFormFile({ buffer: PDF, originalName: "cv.pdf", allowed: ["pdf"], maxBytes: 1024 * 1024 });
  await db.upload.update({ where: { id: upload.id }, data: { createdAt: new Date(Date.now() - ageMs) } });
  return upload;
}

describe("pruneUnclaimedFormFiles", () => {
  it("deletes only abandoned uploads past twice the claim window, with their files", async () => {
    const abandoned = await stored(2 * CLAIM_WINDOW_MS + 60_000);
    const recent = await stored(CLAIM_WINDOW_MS);
    const claimedOld = await stored(3 * CLAIM_WINDOW_MS);
    const form = await db.form.create({ data: { slug: "prune-test", name: "Prune", draftDefinition: {} } });
    const version = await db.formVersion.create({ data: { formId: form.id, version: 1, definition: {} } });
    const response = await db.formResponse.create({ data: { formId: form.id, versionId: version.id, data: {}, searchText: "", pagePath: [], ipHash: "x", userAgent: "t" } });
    await db.upload.update({ where: { id: claimedOld.id }, data: { formResponseId: response.id } });

    expect(await pruneUnclaimedFormFiles()).toBe(1);
    expect(await db.upload.findUnique({ where: { id: abandoned.id } })).toBeNull();
    expect(existsSync(path.join(visibilityRoot("PRIVATE"), abandoned.storageKey))).toBe(false);
    expect(await db.upload.count({ where: { id: { in: [recent.id, claimedOld.id] } } })).toBe(2);
    expect(existsSync(path.join(visibilityRoot("PRIVATE"), recent.storageKey))).toBe(true);
  });
});
