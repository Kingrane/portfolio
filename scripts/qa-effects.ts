import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const url = process.env.QA_URL ?? "http://127.0.0.1:4173/portfolio/";
// Prepared for v3; do not run without permission against a freshly served export.
const out = process.env.QA_OUT ?? "C:\\Users\\REDMI\\AppData\\Local\\Temp\\opencode\\portfolio-qa-v3-effects";
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
    await page.addInitScript(() => {
      const stats = window as unknown as Window & { __qaDraws: number };
      stats.__qaDraws = 0;
      const prototype = WebGL2RenderingContext.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
      for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
        const original = prototype[name];
        prototype[name] = function (...args: unknown[]) {
          stats.__qaDraws++;
          return Reflect.apply(original, this, args);
        };
      }
    });
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
    await page.locator("#projects article").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    const card = page.locator("#projects article").first();
    const cardBox = (await card.boundingBox())!;
    if (!mobile) {
      await page.mouse.move(cardBox.x + cardBox.width * 0.2, cardBox.y + cardBox.height * 0.4);
      await page.waitForTimeout(200);
      const left = await card.evaluate((element) => parseFloat((element as HTMLElement).style.getPropertyValue("--card-ry")));
      await page.mouse.move(cardBox.x + cardBox.width * 0.8, cardBox.y + cardBox.height * 0.4);
      await page.waitForTimeout(200);
      const right = await card.evaluate((element) => parseFloat((element as HTMLElement).style.getPropertyValue("--card-ry")));
      assert.ok(left > 0 && right < 0 && Math.abs(left) <= 3 && Math.abs(right) <= 3, "card tilts toward the pointer edge");
      await page.screenshot({ path: join(out, "effects", "desktop-card-tilt.png"), scale: "css" });
      await page.mouse.move(1, 1);
      await page.waitForTimeout(800);
      assert.equal(await card.evaluate((element) => (element as HTMLElement).style.getPropertyValue("--card-ry")), "0deg");
    }
    await page.screenshot({ path: join(out, "effects", `${name}-projects.png`), scale: "css" });
    const projects = page.locator("#projects");
    const all = projects.getByRole("button", { name: /^ALL\b/ });
    await all.click();
    await page.waitForTimeout(750);
    const entries = await projects.locator("article").evaluateAll((cards) => cards.map((card) => ({
      title: card.querySelector("h3")?.textContent?.trim() ?? "",
      description: card.querySelector("p")?.textContent?.trim() ?? "",
      tags: [...card.querySelectorAll("ul li")].map((tag) => tag.textContent?.trim() ?? ""),
    })));
    assert.equal(entries.length, 13, "all actual vibe projects are present");
    for (const title of ["holoterm", "Bobik-2B"]) {
      assert.ok(entries.find((entry) => entry.title === title)?.description, `${title}: approved short description`);
    }
    const covers: unknown[] = [];
    for (let i = 0; i < entries.length; i++) {
      const card = projects.locator("article").nth(i);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(750);
      const cover = card.locator("canvas");
      const path = join(out, "effects", `${name}-cover-${String(i + 1).padStart(2, "0")}.png`);
      const image = await cover.screenshot({ path, scale: "css" });
      const bounds = (await cover.boundingBox())!;
      assert.ok(Math.abs(bounds.width / bounds.height - 1.6) < 0.02, "16:10 cover");
      covers.push({ ...entries[i], path, sha256: createHash("sha256").update(image).digest("hex") });
    }
    const chips = projects.getByRole("button");
    assert.ok(await chips.count() <= 7, "six facets plus ALL at most");
    for (let i = 1; i < await chips.count(); i++) {
      const chip = chips.nth(i);
      const label = (await chip.locator("span").first().textContent())!.trim();
      const expected = entries.filter((entry) => entry.tags.includes(label));
      await chip.click();
      await page.waitForTimeout(750);
      assert.equal(await projects.locator("article").count(), expected.length, `${label}: filter count matches data`);
      await page.screenshot({ path: join(out, "effects", `${name}-filter-${i}.png`), scale: "css" });
      await all.click();
      await page.waitForTimeout(750);
    }
    await page.locator("#garden").scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(out, "effects", `${name}-garden.png`), scale: "css" });
    const gardenRows = page.locator("#garden li.group");
    assert.equal(await gardenRows.count(), 4, "four handmade flowers/projects");
    for (let i = 0; i < 4; i++) {
      const row = gardenRows.nth(i);
      await row.scrollIntoViewIfNeeded();
      if (mobile) await row.locator("a").focus();
      else await row.hover();
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(out, "effects", `${name}-garden-project-${i + 1}.png`), scale: "css" });
    }
    // Evidence only: manually inspect butterflies, landings and the evolving
    // ASCII trail. DOM assertions cannot certify a shader's visual appearance.
    for (let i = 0; i < 18; i++) {
      await page.waitForTimeout(900);
      await page.screenshot({ path: join(out, "effects", `${name}-garden-event-${String(i).padStart(2, "0")}.png`), scale: "css" });
    }
    // Synthetic visibility event exercises the application's pause path, not
    // Chrome's separate background-tab throttling. Count actual WebGL draws.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);
    const pausedAt = await page.evaluate(() => (window as unknown as Window & { __qaDraws: number }).__qaDraws);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => (window as unknown as Window & { __qaDraws: number }).__qaDraws), pausedAt, "no WebGL draws while hidden");
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => (window as unknown as Window & { __qaDraws: number }).__qaDraws) > pausedAt, "drawing resumes on visibility");
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
    results.push({ viewport, canvasCount: 1, heading: "Стэк", covers, visualReviewRequired: "hole/rain/unique scenes/landings/trails/garden row contrast", warmTrailPixels: { before, during, after }, contextRestore: true, syntheticVisibilityPause: "draw calls stop and resume", cardTilt: mobile ? "disabled on touch" : "left/right/reset passed", errors });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(join(out, "effects.json"), JSON.stringify(results, null, 2));
}
console.log("One canvas, heading, emissive/decaying trail and shader runtime passed; inspect effects screenshots manually.");
