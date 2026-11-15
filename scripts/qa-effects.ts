import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const url = process.env.QA_URL ?? "http://127.0.0.1:4173/portfolio/";
const out = process.env.QA_OUT ?? "C:\\Users\\REDMI\\AppData\\Local\\Temp\\opencode\\portfolio-qa-phase-b";
const canvasOnly = "body * { visibility: hidden !important; } canvas[data-qa-webgl] { visibility: visible !important; }";
const results: unknown[] = [];
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
await mkdir(join(out, "effects"), { recursive: true });

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const mobile = viewport.width < 768;
    const name = mobile ? "mobile" : "desktop";
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => { if (e.type() === "error") errors.push(e.text()); });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const canvas = page.locator("canvas[data-qa-webgl]");
    await canvas.waitFor({ state: "visible" });
    await page.waitForTimeout(8000);
    assert.equal(await page.locator("[data-world-canvas] canvas").count(), 1, "one WebGL context");
    assert.equal(await page.locator("#stack h2").textContent(), "Стэк");
    await page.screenshot({ path: join(out, "effects", `${name}-hero.png`), scale: "css" });
    await canvas.screenshot({ path: join(out, "effects", `${name}-world.png`), style: canvasOnly, scale: "css" });

    // A trail must emit glyphs even in empty space, not just recolor a disk.
    // Compare warm-lit pixels in a lower hero strip far away from the hole.
    const strip = { left: Math.round(viewport.width * 0.18), top: Math.round(viewport.height * 0.83), width: Math.round(viewport.width * 0.64), height: Math.round(viewport.height * 0.12) };
    const warmPixels = async (buffer: Buffer) => {
      const { data, info } = await sharp(buffer).extract(strip).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let count = 0;
      for (let i = 0; i < data.length; i += info.channels) if (data[i] > 45 && data[i] > data[i + 2] * 1.4 && data[i + 1] > 15) count++;
      return count;
    };
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1700);
    const before = await warmPixels(await canvas.screenshot({ style: canvasOnly, scale: "css" }));
    const y = strip.top + strip.height * 0.55;
    await page.mouse.move(strip.left + 5, y);
    await page.mouse.move(strip.left + strip.width - 5, y, { steps: 36 });
    const trailImage = await canvas.screenshot({ path: join(out, "effects", `${name}-trail-canvas.png`), style: canvasOnly, scale: "css" });
    const during = await warmPixels(trailImage);
    await page.screenshot({ path: join(out, "effects", `${name}-trail.png`), scale: "css" });
    assert.ok(during > before + 20, `${name}: visible emissive glyph trail (${before} -> ${during})`);
    await page.mouse.move(1, 1);
    await page.waitForTimeout(2000);
    const after = await warmPixels(await canvas.screenshot({ style: canvasOnly, scale: "css" }));
    assert.ok(after < during, `${name}: trail decays without persistent noise`);

    for (const factor of [0.25, 0.5, 0.75]) {
      await page.evaluate((scroll) => window.scrollTo({ top: scroll, behavior: "instant" }), viewport.height * factor);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: join(out, "effects", `${name}-dive-${factor}.png`), scale: "css" });
    }
    await page.locator("#stack").scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.locator("#stack h2").hover();
    await page.screenshot({ path: join(out, "effects", `${name}-stack.png`), scale: "css" });
    await page.locator("#garden").scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(out, "effects", `${name}-garden.png`), scale: "css" });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(1000);
    if (mobile) {
      await page.touchscreen.tap(viewport.width * 0.7, viewport.height * 0.76);
      await page.screenshot({ path: join(out, "effects", "mobile-tap.png"), scale: "css" });
    }
    // The tagged canvas already owns WebGL2: getContext returns that same
    // context, not an extra probe. Exercise the offscreen target after restore.
    const restoreAvailable = await canvas.evaluate((element: HTMLCanvasElement) => {
      const gl = element.getContext("webgl2");
      const extension = gl?.getExtension("WEBGL_lose_context");
      if (!extension) return false;
      extension.loseContext();
      window.setTimeout(() => extension.restoreContext(), 500);
      return true;
    });
    assert.ok(restoreAvailable, `${name}: context recovery test supported`);
    await page.waitForTimeout(1500);
    assert.equal(await canvas.evaluate((element: HTMLCanvasElement) => element.getContext("webgl2")?.isContextLost()), false);
    await page.screenshot({ path: join(out, "effects", `${name}-restored.png`), scale: "css" });
    assert.deepEqual(errors, [], `${name}: shader/runtime errors`);
    results.push({ viewport, canvasCount: 1, heading: "Стэк", warmTrailPixels: { before, during, after }, contextRestore: true, errors });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(join(out, "effects.json"), JSON.stringify(results, null, 2));
}
console.log("One canvas, heading, emissive/decaying trail and shader runtime passed; inspect effects screenshots manually.");
