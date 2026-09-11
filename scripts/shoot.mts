/**
 * Dev QA helper: screenshots pages with the system Chrome (no Playwright browser download).
 *
 *   npx tsx scripts/shoot.mts <outDir> </path[@WIDTHxHEIGHT]>...
 *
 * Signed-in pages: put a session token in QA_TOKEN or data/qa-token.txt (never a password).
 * FULL=1 captures the full page. Prints HTTP status and any page/console errors per shot.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [outDir, ...targets] = process.argv.slice(2);
if (!outDir || targets.length === 0) {
  console.error("usage: npx tsx scripts/shoot.mts <outDir> </path[@WxH]>...");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const base = process.env.BASE_URL ?? "http://localhost:3000";
let token = process.env.QA_TOKEN ?? "";
if (!token) {
  try {
    token = readFileSync("data/qa-token.txt", "utf8").trim();
  } catch {
    token = "";
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome-stable", headless: true });
for (const target of targets) {
  const [path, size = "1440x900"] = target.split("@");
  const [width, height] = size.split("x").map(Number);
  // REDUCED=1 emulates prefers-reduced-motion, so scroll-driven reveals don't hide content in full-page captures.
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: process.env.REDUCED === "1" ? "reduce" : "no-preference" });
  if (token) await context.addCookies([{ name: "gfg_session", value: token, url: base, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const response = await page.goto(base + path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const file = `${outDir}/${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}.png`;
  await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
  console.log(response?.status(), file, errors.length ? `ERRORS: ${errors.join(" | ")}` : "");
  await context.close();
}
await browser.close();
