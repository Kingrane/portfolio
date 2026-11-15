/**
 * Phase A only. Uses an ALREADY served export; never builds or starts a server.
 * Run only with the parent's permission:
 *   $env:QA_ASCII_STAGE = "before" # or "after", once BEFORE evidence is saved
 *   node --experimental-strip-types scripts/qa-ascii.ts
 * QA_URL, QA_OUT and QA_CHROME override the defaults below.
 * Screenshots are CSS-sized at both device DPRs. No pixel-count heuristic can
 * certify visible glyphs, correct masks, glow, dither or readable HTML.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import sharp from "sharp";

type Stage = "before" | "after";
type Mode = "full" | "ambient";
type Scene = "hero" | "garden";
type Profile = { name: "desktop" | "mobile"; width: number; height: number };
type EventRecord = { at: string; run: string; kind: string; message: string; url?: string };
type CanvasState = {
  time: number;
  deviceDpr: number;
  viewport: { width: number; height: number };
  backing: { width: number; height: number };
  css: { x: number; y: number; width: number; height: number };
  rendererDpr: { x: number; y: number };
  attributes: Record<string, string | null>;
  worldCanvasCount: number;
  taggedCanvasCount: number;
  scrollY: number;
  gardenTop: number | null;
  readingBounds: { x: number; y: number; width: number; height: number }[];
};
type Capture = {
  profile: Profile;
  deviceDpr: number;
  mode: Mode;
  scene: Scene;
  url: string;
  htmlScreenshot: string;
  canvasScreenshot: string;
  htmlState: CanvasState;
  canvasState: CanvasState;
  imageSizes?: { html: { width?: number; height?: number }; canvas: { width?: number; height?: number } };
};

const url = process.env.QA_URL ?? "http://127.0.0.1:4173/portfolio/";
const out = resolve(process.env.QA_OUT ?? "C:\\Users\\REDMI\\AppData\\Local\\Temp\\opencode\\portfolio-qa-v3-a");
const stage = process.env.QA_ASCII_STAGE;
const selector = "canvas[data-qa-webgl]";
// Visibility, NOT display:none: all HTML boxes and reading-zone masks survive.
const canvasOnly = `body * { visibility: hidden !important; } ${selector} { visibility: visible !important; }`;
const profiles: Profile[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const attributes = ["full", "cell", "gain", "ambient", "dither", "emitters"].map((key) => `data-qa-ascii-${key}`);
const sliderNames = ["Микс ASCII", "Яркость глифов", "Свечение", "Ячейка desktop", "Ячейка mobile", "Dither"];
const captures: Capture[] = [];
const events: EventRecord[] = [];
const failures: { run: string; message: string }[] = [];
const tuneChecks: unknown[] = [];
const touchChecks: unknown[] = [];
const dprChecks: unknown[] = [];
const startedAt = new Date().toISOString();

function pageUrl(mode: Mode, tune = false): string {
  const target = new URL(url);
  target.searchParams.delete("ascii");
  target.searchParams.delete("tune");
  target.hash = "";
  if (mode === "full") target.searchParams.set("ascii", "full");
  if (tune) target.searchParams.set("tune", "");
  return target.href;
}

function collectErrors(page: Page, run: string): () => void {
  let active = true;
  const add = (kind: string, message: string, requestUrl?: string) => {
    if (active) events.push({ at: new Date().toISOString(), run, kind, message, url: requestUrl });
  };
  page.on("pageerror", (error) => add("pageerror", error.stack ?? error.message));
  page.on("console", (message) => { if (message.type() === "error") add("console:error", message.text()); });
  page.on("requestfailed", (request) => add("requestfailed", request.failure()?.errorText ?? "Request failed", request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) add("http-error", `${response.status()} ${response.statusText()}`, response.url());
  });
  return () => { active = false; };
}

async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((done) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => done())));
  }));
}

async function load(page: Page, target: string): Promise<Locator> {
  await page.goto(target, { waitUntil: "load", timeout: 30000 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const canvas = page.locator(selector).first();
  await canvas.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(3500); // Fonts/reveals/idle scene mount; no animation or time overrides.
  await frames(page);
  return canvas;
}

async function positionScene(page: Page, scene: Scene): Promise<void> {
  const target = await page.evaluate((name) => {
    const garden = document.getElementById("garden");
    if (name === "garden" && !garden) throw new Error("Missing #garden");
    const wanted = name === "hero" ? 0 : garden!.getBoundingClientRect().top + scrollY - innerHeight * 0.2;
    const top = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight, wanted));
    window.scrollTo({ top, left: 0, behavior: "instant" });
    return top;
  }, scene);
  await page.waitForTimeout(750);
  await frames(page);
  await page.waitForFunction((top) => Math.abs(scrollY - top) <= 2, target, { timeout: 3000 });
  if (scene === "garden") {
    const top = await page.locator("#garden").evaluate((element) => element.getBoundingClientRect().top);
    assert.ok(Math.abs(top - await page.evaluate(() => innerHeight * 0.2)) <= 2, "garden starts at 20% of viewport");
  }
}

async function canvasState(canvas: Locator): Promise<CanvasState> {
  return canvas.evaluate((element: HTMLCanvasElement, names) => {
    const box = element.getBoundingClientRect();
    const garden = document.getElementById("garden");
    return {
      time: performance.now(), deviceDpr: devicePixelRatio,
      viewport: { width: innerWidth, height: innerHeight },
      backing: { width: element.width, height: element.height },
      css: { x: box.x, y: box.y, width: box.width, height: box.height },
      rendererDpr: { x: element.width / box.width, y: element.height / box.height },
      attributes: Object.fromEntries(names.map((name) => [name, element.getAttribute(name)])),
      worldCanvasCount: document.querySelectorAll("[data-world-canvas] canvas").length,
      taggedCanvasCount: document.querySelectorAll("canvas[data-qa-webgl]").length,
      scrollY, gardenTop: garden?.getBoundingClientRect().top ?? null,
      readingBounds: [...document.querySelectorAll("[data-reading]")].map((node) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    };
  }, attributes);
}

function numericAttribute(state: CanvasState, name: string): number {
  const raw = state.attributes[`data-qa-ascii-${name}`];
  assert.ok(raw !== null && raw !== undefined && raw.trim() !== "", `canvas exposes ${name}`);
  const value = Number(raw);
  assert.ok(Number.isFinite(value), `canvas ${name} is numeric: ${raw}`);
  return value;
}

function assertAfter(state: CanvasState, profile: Profile, deviceDpr: number, mode: Mode): void {
  assert.equal(state.worldCanvasCount, 1, "one canvas in world container");
  assert.equal(state.taggedCanvasCount, 1, "one tagged WebGL canvas (2D project previews are allowed)");
  assert.equal(state.attributes["data-qa-ascii-full"], String(mode === "full"), "actual canvas debug flag");
  assert.equal(numericAttribute(state, "cell"), profile.name === "desktop" ? 10 : 11, "CSS cell default");
  assert.ok(numericAttribute(state, "gain") >= 1.3 && numericAttribute(state, "gain") <= 1.6, "emissive default gain");
  assert.ok(numericAttribute(state, "ambient") > 0, "normal timeline mix remains enabled; full override is separate");
  assert.ok(numericAttribute(state, "dither") > 0, "dither enabled");
  assert.ok(state.attributes["data-qa-ascii-emitters"] !== null, "actual canvas exposes emitter state");
  assert.equal(state.deviceDpr, deviceDpr);
  assert.equal(state.viewport.width, profile.width);
  assert.equal(state.viewport.height, profile.height);
  assert.ok(Math.abs(state.css.width - profile.width) <= 1 && Math.abs(state.css.height - profile.height) <= 1, "world canvas covers CSS viewport");
  assert.ok(state.rendererDpr.x >= 0.99 && state.rendererDpr.x <= deviceDpr + 0.01, "backing DPR respects renderer caps");
  assert.ok(Math.abs(state.rendererDpr.x - state.rendererDpr.y) <= 0.01, "backing scale is isotropic");
}

async function captureRun(browser: Browser, profile: Profile, deviceDpr: number, mode: Mode, phase: Stage): Promise<void> {
  const run = `${mode}-${profile.name}-dpr${deviceDpr}`;
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: deviceDpr,
    isMobile: profile.name === "mobile", hasTouch: profile.name === "mobile", reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  const stopErrors = collectErrors(page, run);
  try {
    const canvas = await load(page, pageUrl(mode));
    if (phase === "after" && mode === "ambient") assert.equal(await page.locator("[data-tune-panel]").count(), 0, "normal URL has no tune panel");
    for (const scene of ["hero", "garden"] as const) {
      await positionScene(page, scene);
      const stem = `${run}-${scene}`;
      const htmlScreenshot = join(phase, `${stem}.png`);
      const canvasScreenshot = join(phase, `${stem}-canvas.png`);
      const htmlState = await canvasState(canvas);
      await page.screenshot({ path: join(out, htmlScreenshot), fullPage: false, scale: "css", animations: "allow" });
      const isolatedState = await canvasState(canvas);
      await canvas.screenshot({ path: join(out, canvasScreenshot), scale: "css", animations: "allow", style: canvasOnly });
      const record: Capture = { profile, deviceDpr, mode, scene, url: page.url(), htmlScreenshot, canvasScreenshot, htmlState, canvasState: isolatedState };
      captures.push(record); // Persist raw evidence even if assertions below fail.
      const html = await sharp(join(out, htmlScreenshot)).metadata();
      const isolated = await sharp(join(out, canvasScreenshot)).metadata();
      record.imageSizes = { html: { width: html.width, height: html.height }, canvas: { width: isolated.width, height: isolated.height } };
      assert.equal(html.width, profile.width, "HTML screenshot is CSS-sized at either DPR");
      assert.equal(html.height, profile.height);
      assert.equal(isolated.width, profile.width, "canvas screenshot is CSS-sized at either DPR");
      assert.equal(isolated.height, profile.height);
      const restoredState = await canvasState(canvas);
      assert.deepEqual(restoredState.readingBounds, isolatedState.readingBounds, "canvas isolation preserves reading-zone DOM geometry");
      if (phase === "after") {
        assertAfter(htmlState, profile, deviceDpr, mode);
        assertAfter(isolatedState, profile, deviceDpr, mode);
      }
      // BEFORE records any available attributes, but does not require v3 ones.
    }
    assert.deepEqual(events.filter((event) => event.run === run), [], `${run}: runtime/network errors`);
  } catch (error) {
    failures.push({ run, message: error instanceof Error ? error.stack ?? error.message : String(error) });
  } finally {
    stopErrors();
    await context.close();
  }
}

async function setRange(slider: Locator, value: number): Promise<void> {
  // Native setter bypasses React's tracked value so input/change are observable.
  await slider.evaluate((element: HTMLInputElement, next) => {
    if (element.type !== "range") throw new Error("Expected accessible range input");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Missing native input value setter");
    setter.call(element, String(next));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await frames(slider.page());
  assert.equal(await slider.inputValue(), String(value));
}

async function testTune(browser: Browser, profile: Profile): Promise<void> {
  const run = `tune-${profile.name}`;
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const stopErrors = collectErrors(page, run);
  try {
    const canvas = await load(page, pageUrl("ambient", true));
    const button = page.getByRole("button", { name: "Настройка ASCII", exact: true });
    await button.click();
    const panel = page.locator("[data-tune-panel]");
    await panel.waitFor({ state: "visible" });
    const defaults: Record<string, string> = {};
    for (const name of sliderNames) {
      const slider = panel.getByRole("slider", { name, exact: true });
      assert.equal(await slider.count(), 1, `accessible slider: ${name}`);
      assert.ok(await slider.isVisible(), `visible slider: ${name}`);
      assert.equal(await slider.getAttribute("type"), "range");
      defaults[name] = await slider.inputValue();
    }
    const defaultState = await canvasState(canvas);
    assertAfter(defaultState, profile, 1, "ambient");
    const geometry = await panel.evaluate((element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return {
        viewportOverflow: Math.max(0, -box.left, box.right - innerWidth, -box.top, box.bottom - innerHeight),
        panelHorizontalOverflow: Math.max(0, element.scrollWidth - element.clientWidth),
        documentHorizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      };
    });
    if (profile.name === "mobile") {
      assert.ok(geometry.viewportOverflow <= 2 && geometry.panelHorizontalOverflow <= 2 && geometry.documentHorizontalOverflow <= 2, `mobile panel fits: ${JSON.stringify(geometry)}`);
    }
    const screenshot = join("after", `${run}-panel.png`);
    await page.screenshot({ path: join(out, screenshot), scale: "css", animations: "allow" });
    await setRange(panel.getByRole("slider", { name: "Микс ASCII", exact: true }), 0);
    await page.waitForFunction((css) => document.querySelector(css)?.getAttribute("data-qa-ascii-ambient") === "0", selector, { timeout: 3000 });
    const zeroState = await canvasState(canvas);
    assert.equal(numericAttribute(zeroState, "ambient"), 0, "Mix 0 reaches canvas, not just panel state");
    await panel.getByRole("button", { name: /Сброс/ }).click();
    await page.waitForFunction(({ css, expected }) => document.querySelector(css)?.getAttribute("data-qa-ascii-ambient") === expected, { css: selector, expected: defaultState.attributes["data-qa-ascii-ambient"] }, { timeout: 3000 });
    for (const name of sliderNames) assert.equal(await panel.getByRole("slider", { name, exact: true }).inputValue(), defaults[name], `reset default: ${name}`);
    await frames(page);
    const resetState = await canvasState(canvas);
    for (const name of ["cell", "gain", "ambient", "dither"]) assert.equal(resetState.attributes[`data-qa-ascii-${name}`], defaultState.attributes[`data-qa-ascii-${name}`], `reset reaches canvas: ${name}`);
    await panel.getByRole("button", { name: "Закрыть", exact: true }).click();
    await panel.locator('input[type="range"]').first().waitFor({ state: "hidden" });
    // Isolated interaction test, AFTER evidence only. No fabricated emitter data.
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForTimeout(750);
    await frames(page);
    const blurred = (await canvasState(canvas)).attributes["data-qa-ascii-emitters"];
    await page.mouse.move(profile.width * 0.76, profile.height * 0.76);
    await page.waitForFunction(({ css, baseline }) => {
      const value = document.querySelector(css)?.getAttribute("data-qa-ascii-emitters");
      return value !== null && value !== undefined && value !== "" && value !== baseline;
    }, { css: selector, baseline: blurred }, { timeout: 3000 });
    const pointer = (await canvasState(canvas)).attributes["data-qa-ascii-emitters"];
    await page.waitForTimeout(1700); // Longer than v2's 0.62 s trail: stationary cursor must persist.
    const stationary = (await canvasState(canvas)).attributes["data-qa-ascii-emitters"];
    assert.notEqual(stationary, blurred, "stationary cursor remains an emitter");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.waitForFunction(({ css, baseline }) => document.querySelector(css)?.getAttribute("data-qa-ascii-emitters") === baseline, { css: selector, baseline: blurred }, { timeout: 3000 });
    const cleared = (await canvasState(canvas)).attributes["data-qa-ascii-emitters"];
    assert.deepEqual(events.filter((event) => event.run === run), [], `${run}: runtime/network errors`);
    tuneChecks.push({ profile, defaults, geometry, screenshot, defaultState, zeroState, resetState, emitters: { blurred, pointer, stationary, cleared }, status: "automated-checks-passed" });
  } catch (error) {
    failures.push({ run, message: error instanceof Error ? error.stack ?? error.message : String(error) });
  } finally {
    stopErrors();
    await context.close();
  }
}

async function testTouch(browser: Browser): Promise<void> {
  const run = "native-touch-mobile";
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const stopErrors = collectErrors(page, run);
  try {
    const canvas = await load(page, pageUrl("ambient"));
    const cdp = await context.newCDPSession(page);
    for (const ending of ["touchEnd", "touchCancel"] as const) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 305, y: 700, id: 1 }] });
      for (const y of [665, 610, 555, 500]) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 305, y, id: 1 }] });
        await frames(page);
      }
      await page.waitForFunction((css) => Number(document.querySelector(css)?.getAttribute("data-qa-ascii-emitters")) > 0, selector);
      const moving = await canvasState(canvas);
      await cdp.send("Input.dispatchTouchEvent", { type: ending, touchPoints: [] });
      await page.waitForFunction((css) => document.querySelector(css)?.getAttribute("data-qa-ascii-emitters") === "0", selector);
      const ended = await canvasState(canvas);
      touchChecks.push({ ending, moving, ended, method: "Chrome CDP native touch gesture, not synthetic DOM source data", status: "passed" });
    }
    await cdp.detach();
    assert.deepEqual(events.filter((event) => event.run === run), [], `${run}: runtime/network errors`);
  } catch (error) {
    failures.push({ run, message: error instanceof Error ? error.stack ?? error.message : String(error) });
  } finally {
    stopErrors();
    await context.close();
  }
}

function verifyDpr(phase: Stage): void {
  for (const profile of profiles) for (const scene of ["hero", "garden"] as const) {
    const low = captures.find((capture) => capture.profile.name === profile.name && capture.scene === scene && capture.mode === "full" && capture.deviceDpr === 1);
    const high = captures.find((capture) => capture.profile.name === profile.name && capture.scene === scene && capture.mode === "full" && capture.deviceDpr === 2);
    if (!low || !high) { failures.push({ run: `dpr-${profile.name}-${scene}`, message: "Missing paired DPR captures" }); continue; }
    const changedBacking = high.htmlState.rendererDpr.x > low.htmlState.rendererDpr.x + 0.05;
    const check = { profile: profile.name, scene, dpr1: low.htmlState, dpr2: high.htmlState, changedBacking, cssSizedImages: low.imageSizes?.html.width === high.imageSizes?.html.width && low.imageSizes?.html.height === high.imageSizes?.html.height };
    dprChecks.push(check);
    if (phase === "after") {
      try {
        assert.equal(low.htmlState.attributes["data-qa-ascii-cell"], high.htmlState.attributes["data-qa-ascii-cell"], "cell remains constant in CSS pixels");
        assert.ok(changedBacking, "DPR2 must actually render a larger backing buffer; a device label alone is not DPR proof");
        assert.ok(check.cssSizedImages, "DPR screenshot dimensions remain identical");
      } catch (error) {
        failures.push({ run: `dpr-${profile.name}-${scene}`, message: error instanceof Error ? error.message : String(error) });
      }
    }
  }
}

async function main(): Promise<void> {
  assert.ok(stage === "before" || stage === "after", "Set QA_ASCII_STAGE explicitly to before or after");
  const phase: Stage = stage;
  await mkdir(join(out, phase), { recursive: true });
  let browser: Browser | undefined;
  let browserInfo: { executablePath: string; version?: string } | undefined;
  try {
    const bundled = chromium.executablePath();
    const executablePath = process.env.QA_CHROME ?? (existsSync(bundled) ? bundled : "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
    browserInfo = { executablePath };
    browser = await chromium.launch({ executablePath, headless: true });
    browserInfo.version = browser.version();
    // BEFORE: 8 scene pairs (16 PNGs). AFTER adds 4 ambient pairs at DPR1.
    for (const profile of profiles) for (const dpr of [1, 2]) await captureRun(browser, profile, dpr, "full", phase);
    verifyDpr(phase);
    if (phase === "after") {
      for (const profile of profiles) await captureRun(browser, profile, 1, "ambient", phase);
      for (const profile of profiles) await testTune(browser, profile);
      await testTouch(browser);
    }
  } catch (error) {
    failures.push({ run: "main", message: error instanceof Error ? error.stack ?? error.message : String(error) });
  } finally {
    try { await browser?.close(); } catch (error) { failures.push({ run: "close", message: String(error) }); }
    const expected = phase === "before" ? 8 : 12;
    const complete = captures.length === expected && (phase === "before" || (tuneChecks.length === profiles.length && touchChecks.length === 2));
    const status = failures.length || events.length ? "failed" : complete ? "automated-checks-passed-manual-review-required" : "incomplete";
    const manifest = join(out, phase, "ascii-qa.json");
    await writeFile(manifest, JSON.stringify({
      status, stage: phase, startedAt, finishedAt: new Date().toISOString(), url, out, browser: browserInfo,
      captureCount: captures.length, expectedCaptureCount: expected, captures, dprChecks, tuneChecks, touchChecks, events, failures,
      method: "Live animated viewport plus isolated canvas at different instants. Fonts awaited; time, ambient masks and renderer quality untouched during evidence capture. Screenshot visibility CSS preserves DOM bounds. Backing-buffer dimensions are measured, not inferred from emulated device DPR. Tune/blur tests run separately after evidence.",
      manualReviewRequired: [
        "BEFORE full hero/garden: inspect desktop and mobile HTML/canvas pairs; visible colored glyphs are NOT certified by metadata.",
        "AFTER full: inspect glyph shapes, emission, slight glow, and clean dark cells. Confirm visual CSS glyph size using paired DPR images.",
        "AFTER ambient: inspect outer disk and garden petals/leaves; bright cores/stars stay clean and reading zones protect HTML.",
        "Inspect real Bayer 8x8 patterns on gradients; enabled dither metadata does not prove their appearance.",
        "Existing scripts/qa.ts still owns pixel contrast and seam checks; neither is replaced or claimed by this Phase A script.",
      ],
      performance: "not measured", visualGlyphProof: "manual-review-required", rendererIdentity: "not queried; no probe WebGL context allocated",
    }, null, 2), "utf8");
    process.exitCode = status === "failed" || status === "incomplete" ? 1 : 0;
    console.log(`ASCII ${phase}: ${status}; raw evidence: ${manifest}`);
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 2; });
