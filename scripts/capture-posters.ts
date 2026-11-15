import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const out = join(process.cwd(), "public", "scene");
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
await mkdir(out, { recursive: true });
try {
  for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]] as const) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(process.env.QA_URL ?? "http://127.0.0.1:4173/portfolio/");
    await page.evaluate(() => document.fonts.ready);
    await page.locator("canvas[data-qa-webgl]").waitFor({ state: "visible" });
    await page.waitForTimeout(6000);
    // The poster is the world alone. Remove reading marks and request a layout
    // resample, so invisible HTML never burns static dark patches into it.
    await page.evaluate(() => {
      document.querySelectorAll("[data-reading]").forEach((element) => element.removeAttribute("data-reading"));
      window.dispatchEvent(new Event("resize"));
    });
    for (const phase of ["hero", "night"] as const) {
      if (phase === "night") await page.locator("#stack").scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      const pixels = await page.locator("canvas[data-qa-webgl]").screenshot({
        scale: "css", style: "body * { visibility: hidden !important; } canvas[data-qa-webgl] { visibility: visible !important; }",
      });
      await sharp(pixels).webp({ quality: 88 }).toFile(join(out, `${phase}-${name}.webp`));
    }
    await context.close();
  }
} finally { await browser.close(); }
console.log(`Clean scene posters saved to ${out}`);
