import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";

const BRAND_DARK = "#1F582E";

async function logoTilePng(size: number): Promise<Buffer> {
  const logo = await readFile(path.join(process.cwd(), "public/brand/logo.png"));
  const radius = Math.round(size * 0.22);
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#EEF4EF"/></svg>`,
  );
  const inner = Math.round(size * 0.82);
  return sharp(tile)
    .composite([{ input: await sharp(logo).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), gravity: "center" }])
    .png()
    .toBuffer();
}

/** QR as PNG (1024px). Branded codes use chapter green and the logo tile; error correction H keeps them scannable. */
export async function renderQrPng(url: string, branded: boolean): Promise<Buffer> {
  const size = 1024;
  const qr = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: size,
    color: { dark: branded ? BRAND_DARK : "#000000", light: "#FFFFFF" },
  });
  if (!branded) return qr;
  const tileSize = Math.round(size * 0.22);
  return sharp(qr)
    .composite([{ input: await logoTilePng(tileSize), gravity: "center" }])
    .png()
    .toBuffer();
}

export async function renderQrSvg(url: string, branded: boolean): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    color: { dark: branded ? BRAND_DARK : "#000000", light: "#FFFFFF" },
  });
  if (!branded) return svg;
  const n = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1] ?? 0);
  if (!n) return svg;
  const tile = n * 0.22;
  const offset = (n - tile) / 2;
  const png = (await logoTilePng(256)).toString("base64");
  const overlay = `<image x="${offset}" y="${offset}" width="${tile}" height="${tile}" href="data:image/png;base64,${png}"/>`;
  return svg.replace("</svg>", `${overlay}</svg>`);
}
