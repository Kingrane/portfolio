/** VISUAL_OUT=perf/candidate to capture a candidate. Never overwrites an existing manifest. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { launch, ready, scrollTo, url } from "./perf/common.ts";

const output = resolve(process.env.VISUAL_OUT ?? "perf/baseline");
const time = Number(process.env.FREEZE_TIME ?? 12);
const profiles = [
  { name: "desktop-dpr1", width: 1440, height: 900, dpr: 1 },
  { name: "desktop-dpr2", width: 1440, height: 900, dpr: 2 },
  { name: "mobile-dpr2.75", width: 390, height: 844, dpr: 2.75 },
];
if (existsSync(join(output, "manifest.json"))) throw new Error(`Refusing to overwrite ${output}; choose a new VISUAL_OUT.`);
await mkdir(output, { recursive: true });
// CSS rasterization only: WebGL still uses the same hardware ANGLE renderer.
// Avoid GPU raster rounding/dither noise over translucent DOM gradients.
const browser = await launch(undefined, ["--disable-gpu-rasterization"]);
const frames: unknown[] = [];
const errors: string[] = [];
try {
  for (const profile of profiles.filter((profile) => !process.env.VISUAL_PROFILES || process.env.VISUAL_PROFILES.split(",").includes(profile.name))) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: profile.dpr,
      isMobile: profile.width < 640, hasTouch: profile.width < 640, reducedMotion: "no-preference" });
    const address = new URL(url); address.searchParams.set("freeze", String(time));
    const steps = process.env.VISUAL_STEPS ? process.env.VISUAL_STEPS.split(",").map(Number) : Array.from({ length: 11 }, (_, i) => i * 10);
    if (process.env.VISUAL_REVERSE === "1") steps.reverse();
    for (const percent of steps) {
      // Fresh document per frame: Chromium gradient dithering must not depend
      // on scroll-direction-specific raster tile/cache history.
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${profile.name}: ${error.message}`));
      page.on("console", (message) => { if (message.type() === "error") errors.push(`${profile.name}: ${message.text()}`); });
      await page.goto(address.href, { waitUntil: "load" });
      await ready(page, false);
      await page.mouse.move(-100, -100);
      await scrollTo(page, percent / 100);
      // Reveals settle first, then the mask is recomputed from frozen DOM bounds.
      await page.waitForTimeout(2200);
      await page.evaluate((time) => {
        for (const animation of document.getAnimations()) {
          const timing = animation.effect?.getComputedTiming();
          if (timing?.iterations === Infinity) { animation.pause(); animation.currentTime = time * 1000; }
          else { try { animation.finish(); } catch { animation.pause(); } }
        }
        window.dispatchEvent(new Event("resize"));
      }, time);
      await page.waitForTimeout(250);
      const quality = await page.getAttribute("[data-world-canvas]", "data-qa-quality");
      if (quality !== "1") throw new Error(`freeze must use default quality 1, got ${quality}`);
      const name = `${profile.name}-${String(percent).padStart(3, "0")}.png`;
      const bytes = await page.screenshot({ path: join(output, name), animations: "allow", scale: "device" });
      const geometry = await page.evaluate(() => ({ scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight,
        viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, canvas: [document.querySelector("canvas[data-qa-webgl]")!.getAttribute("width"), document.querySelector("canvas[data-qa-webgl]")!.getAttribute("height")] }));
      frames.push({ name, percent, profile, freeze: time, quality, geometry, sha256: createHash("sha256").update(bytes).digest("hex") });
      console.log(name);
      await page.close();
    }
    await context.close();
  }
  const manifest = { schema: 1, createdAt: new Date().toISOString(), commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    exportHTMLSHA256: createHash("sha256").update(await readFile("out/index.html")).digest("hex"),
    url, chrome: browser.version(), freeze: time, frames, errors, cssRaster: "CPU (--disable-gpu-rasterization), WebGL remains hardware ANGLE", freshDocumentPerFrame: true,
    note: "Unoptimized phase-0 tree plus explicitly requested UI commit; query freezes uniforms, harness freezes DOM animation. Device-pixel screenshots, pointer outside viewport." };
  await writeFile(join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  if (errors.length) throw new Error(`Runtime errors: ${errors.join("\n")}`);
} finally { await browser.close(); }
