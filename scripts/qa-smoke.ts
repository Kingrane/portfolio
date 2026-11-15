import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const url = process.env.QA_URL ?? "http://127.0.0.1:4173/portfolio/";
const out = process.env.QA_OUT ?? "C:\\Users\\REDMI\\AppData\\Local\\Temp\\opencode\\portfolio-qa-phase-a";
const results: unknown[] = [];
const browser = await chromium.launch({ executablePath: process.env.QA_CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
await mkdir(out, { recursive: true });

try {
  for (const fallback of ["reduced-motion", "save-data", "no-webgl", "touch"] as const) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: fallback === "reduced-motion" ? "reduce" : "no-preference" });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => { if (e.type() === "error") errors.push(e.text()); });
    if (fallback === "save-data") await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    });
    if (fallback === "no-webgl") await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
        return /^webgl/.test(String(args[0])) ? null : Reflect.apply(original, this, args);
      };
    });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(3500);
    const canvases = await page.locator("[data-world-canvas] canvas").count();
    assert.equal(canvases, fallback === "touch" ? 1 : 0, `${fallback}: live canvas count`);
    assert.equal((await page.locator("h1").textContent())?.replace(/\s/g, ""), "KINGRANEKINGRANE");
    const menu = page.getByRole("button", { name: "Открыть меню" });
    await menu.focus();
    await menu.click();
    assert.equal(await page.locator("dialog").evaluate((el: HTMLDialogElement) => el.open), true);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflowY), "hidden");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog").evaluate((el: HTMLDialogElement) => el.open), false);
    assert.equal(await menu.evaluate((el) => el === document.activeElement), true);
    await menu.click();
    await page.locator("dialog").getByRole("link", { name: "Проекты", exact: true }).click();
    await page.waitForTimeout(700);
    assert.equal(await page.locator("dialog").evaluate((el: HTMLDialogElement) => el.open), false);
    assert.equal(await page.evaluate(() => document.body.dataset.locked), undefined);
    const filters = page.locator("#projects button[aria-pressed]");
    assert.equal(await filters.count(), 7);
    const before = await page.locator("#projects article").count();
    await filters.nth(1).click();
    const filtered = await page.locator("#projects article").count();
    assert.ok(filtered > 0 && filtered < before);
    await filters.first().click();
    assert.equal(await page.locator("#projects article").count(), before);
    assert.equal(await page.evaluate(() => localStorage.getItem("kingrane:render-mode")), null);
    assert.deepEqual(errors, [], `${fallback}: runtime errors`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(out, `fallback-${fallback}.png`), scale: "css" });
    results.push({ fallback, canvases, filters: 7, before, filtered, menu: "focus/escape/lock/anchor passed", errors });
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(join(out, "smoke.json"), JSON.stringify(results, null, 2));
}
console.log("Fallbacks, touch, menu and filters passed.");
