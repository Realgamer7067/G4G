import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderQrPng, renderQrSvg } from "./qr";

const url = "https://gfg.example.edu/events/code-sprint";

describe("QR rendering", () => {
  it("renders a 1024px PNG, with or without branding", async () => {
    for (const branded of [false, true]) {
      const meta = await sharp(await renderQrPng(url, branded)).metadata();
      expect(meta).toMatchObject({ format: "png", width: 1024, height: 1024 });
    }
  });

  it("uses chapter green and embeds the logo tile in branded SVGs", async () => {
    const plain = await renderQrSvg(url, false);
    const branded = await renderQrSvg(url, true);
    expect(plain).toContain("<svg");
    expect(plain).not.toContain("<image");
    expect(branded).toContain("<image");
    expect(branded.toLowerCase()).toContain("#1f582e");
  });
});
