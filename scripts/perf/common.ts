import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium, type Page } from "playwright";
import type { PerfAPI } from "../../src/components/diagnostics/perf";

export const url = process.env.PERF_URL ?? "http://127.0.0.1:4177/portfolio/";
export const output = resolve(process.env.PERF_OUT ?? "perf/results");
export const chrome = process.env.PERF_CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
export const profiles = [
  { name: "desktop-headless", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, mobile: false, headless: true },
  { name: "desktop-120hz", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, cpu: 1, mobile: false, headless: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, cpu: 4, mobile: true, headless: true },
];
export type PerfWindow = Window & { __portfolioPerf: PerfAPI };
export async function save(path: string, value: unknown): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}
export async function launch(headless = process.env.PERF_HEADLESS === "1", args: string[] = []) {
  if (!existsSync(chrome)) throw new Error(`Chrome not found: ${chrome}. Set PERF_CHROME; browsers are not installed automatically.`);
  return chromium.launch({ executablePath: chrome, headless, args,
    ignoreDefaultArgs: ["--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] });
}
export async function ready(page: Page, perf = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForSelector('canvas[data-qa-webgl][data-qa-ascii-gain]', { timeout: 60000 });
  if (perf) {
    await page.waitForFunction(() => !!(window as PerfWindow).__portfolioPerf, null, { timeout: 60000 });
    await page.evaluate(() => (window as PerfWindow).__portfolioPerf.panel(false));
  }
}
export async function scrollTo(page: Page, target: number | string): Promise<void> {
  const y = await page.evaluate((target) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = typeof target === "number" ? max * target
      : target === "hero" ? 0 : target === "footer" ? max
        : (document.getElementById(target)?.getBoundingClientRect().top ?? 0) + scrollY - innerHeight * 0.2;
    const clamped = Math.max(0, Math.min(max, y));
    window.scrollTo({ top: clamped, behavior: "instant" });
    return clamped;
  }, target);
  await page.waitForFunction((y) => Math.abs(scrollY - y) < 2, y);
}
export const resultPath = (name: string) => join(output, name);
