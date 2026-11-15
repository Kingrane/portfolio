/**
 * Run against an ALREADY built and served static export; this script never builds it.
 *   node --experimental-strip-types scripts/qa.ts
 * QA_URL / QA_OUT override the defaults below. Install playwright separately.
 * QA_CHROME overrides the system Chrome fallback; QA_SEAM_FRAMES (>=81) and
 * QA_SEAM_SECONDS control sampling. No Lighthouse score is inferred from this QA.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Browser, Locator, Page } from "playwright";
import sharp from "sharp";

type Rect = { x: number; y: number; width: number; height: number };
type TextSample = {
  selector: string;
  text: string;
  readingZone: boolean;
  rects: Rect[];
  foreground: number[];
  opacity: number;
  unsupported: string[];
};
type GeometryIssue = { selector: string; text: string; reason: string; rect: Rect };
type Metrics = {
  time: number;
  scrollX: number;
  scrollY: number;
  maxScroll: number;
  progress: number;
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  horizontalOverflow: number;
  readingZones: { id: string; rect: Rect; crossesViewport: boolean }[];
};
type QAWindow = Window & {
  __portfolioQA?: { start: number; duration: number; maxScroll: number; raf: number };
};
type ContrastResult = {
  selector: string;
  text: string;
  readingZone: boolean;
  foreground: number[];
  effectiveOpacity: number;
  rects: Rect[];
  samples: number;
  minRatio: number | null;
  p05Ratio: number | null;
  passes: boolean | null;
  unsupported: string[];
};
type Checkpoint = {
  requestedProgress: number;
  metrics: Metrics;
  scrollReached: boolean;
  screenshot?: string;
  backgroundScreenshot?: string;
  backgroundMetrics?: Metrics;
  clipping: GeometryIssue[];
  reachableHorizontalScroll: GeometryIssue[];
  intentionalTickerClipping: GeometryIssue[];
  contrast?: ContrastResult[];
};
type Frame = {
  index: number;
  full: string;
  canvas: string;
  fullMetrics: Metrics;
  canvasMetrics: Metrics;
};
type Delta = {
  frame: number;
  progress: number;
  scrollY: number;
  elapsedMs: number;
  scrollStep: number;
  fullMad: number;
  canvasMad: number;
  textBoundaryChanges: string[];
  fullSpike: boolean;
  canvasSpike: boolean;
  fullLocalThreshold?: number;
  canvasLocalThreshold?: number;
  classification: "typical" | "text-or-layout-not-world-seam" | "suspected-world-seam";
};
type SeamResult = {
  status: "complete" | "incomplete";
  reason?: string;
  durationMs?: number;
  frames: Frame[];
  deltas: Delta[];
  fullBaseline?: ReturnType<typeof robustBaseline>;
  canvasBaseline?: ReturnType<typeof robustBaseline>;
  sampling?: { distinctPositions: number; startProgress: number; endProgress: number; maxGap: number; medianGap: number; adequate: boolean };
};
type Run = { viewport: { width: number; height: number }; checkpoints: Checkpoint[]; seam?: SeamResult };
type EventRecord = { at: string; viewport: string; stage: string; kind: string; message: string; url?: string; location?: unknown };

const url = process.env.QA_URL ?? "http://127.0.0.1:4173/portfolio/";
const out = resolve(process.env.QA_OUT ?? "C:\\Users\\REDMI\\AppData\\Local\\Temp\\opencode\\portfolio-qa-phase-a");
const runs: Run[] = [];
const events: EventRecord[] = [];
const startedAt = new Date().toISOString();
const canvasSelector = "canvas[data-qa-webgl]";
// Text fill, NOT color, is hidden: currentColor backgrounds/borders and all layout
// (including data-reading bounds sent to shaders) remain unchanged.
const transparentText = `
  [data-reading], [data-reading] *, [data-qa-text], [data-qa-text] * {
    -webkit-text-fill-color: transparent !important;
    text-shadow: none !important; text-decoration-color: transparent !important;
    caret-color: transparent !important;
  }
  svg text[data-qa-text], svg [data-qa-text] text { fill: transparent !important; stroke: transparent !important; }
`;
// Locator screenshots normally ALSO include overlapping HTML! Explicitly hide it
// without removing boxes or changing color/currentColor. Restore after each shot.
const canvasOnly = `body * { visibility: hidden !important; }
  ${canvasSelector} { visibility: visible !important; }`;

function envNumber(name: string, fallback: number, minimum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${name} must be >= ${minimum}`);
  return value;
}

async function saveJson(path: string, value: unknown): Promise<void> {
  await writeFile(join(out, path), JSON.stringify(value, null, 2), "utf8");
}

async function metrics(page: Page): Promise<Metrics> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const documentWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
    const maxScroll = Math.max(0, root.scrollHeight - innerHeight);
    return {
      time: performance.now(), scrollX, scrollY, maxScroll,
      progress: maxScroll ? scrollY / maxScroll : 0,
      viewportWidth: innerWidth, viewportHeight: innerHeight, documentWidth,
      horizontalOverflow: Math.max(0, documentWidth - root.clientWidth),
      readingZones: [...document.querySelectorAll("[data-reading]")].flatMap((element, index) => {
        const r = element.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight || !r.width || !r.height) return [];
        return [{ id: element.id || `reading-${index}`, rect: { x: r.x, y: r.y, width: r.width, height: r.height }, crossesViewport: r.top < 0 || r.bottom > innerHeight }];
      }),
    };
  });
}

async function scrollToProgress(page: Page, progress: number): Promise<boolean> {
  const target = await page.evaluate((p) => {
    const top = Math.max(0, document.documentElement.scrollHeight - innerHeight) * p;
    window.scrollTo({ top, left: 0, behavior: "instant" });
    return top;
  }, progress);
  // Leave scrub/reading-zone uniforms time to settle, without disabling animation.
  await page.waitForTimeout(400);
  try {
    await page.waitForFunction((top) => Math.abs(scrollY - top) <= 3, target, { timeout: 2500 });
    return true;
  } catch {
    return false;
  }
}

async function inspectTextAndGeometry(page: Page): Promise<{ text: TextSample[]; clipping: GeometryIssue[]; reachable: GeometryIssue[]; ticker: GeometryIssue[] }> {
  return page.evaluate(() => {
    const text: TextSample[] = [];
    const clipping: GeometryIssue[] = [];
    const reachable: GeometryIssue[] = [];
    const ticker: GeometryIssue[] = [];
    const seenIssues = new Set<string>();
    const paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    paint.canvas.width = paint.canvas.height = 1;
    const rect = (r: DOMRect): Rect => ({ x: r.x, y: r.y, width: r.width, height: r.height });
    const label = (el: Element): string => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts: string[] = [];
      for (let node: Element | null = el; node && parts.length < 5; node = node.parentElement) {
        const siblings = node.parentElement ? [...node.parentElement.children].filter((s) => s.tagName === node!.tagName) : [];
        parts.unshift(`${node.tagName.toLowerCase()}${siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(node) + 1})` : ""}`);
      }
      return parts.join(" > ");
    };
    const visible = (el: Element): boolean => {
      if (el.closest('[aria-hidden="true"], [hidden], [inert], [aria-disabled="true"], :disabled, script, style, noscript, template')) return false;
      const r = el.getBoundingClientRect();
      for (let node: Element | null = el; node; node = node.parentElement) {
        const s = getComputedStyle(node);
        if (s.display === "none" || s.visibility !== "visible" || Number(s.opacity) === 0) return false;
      }
      const s = getComputedStyle(el);
      // Accessible sr-only labels aren't visible informative text.
      return !(r.width <= 2 && r.height <= 2 && (s.clip !== "auto" || s.clipPath !== "none" || s.overflow === "hidden"));
    };
    const recordClipping = (el: Element, content: string, r: DOMRect): void => {
      if (r.bottom <= 0 || r.top >= innerHeight || !r.width || !r.height) return;
      let reason = r.left < -2 || r.right > innerWidth + 2 ? "outside-horizontal-viewport" : "";
      let scrollable = false;
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const s = getComputedStyle(parent);
        const p = parent.getBoundingClientRect();
        const crossesX = r.left < p.left - 2 || r.right > p.right + 2;
        const crossesY = r.top < p.top - 2 || r.bottom > p.bottom + 2;
        if (/auto|scroll/.test(s.overflowX) && parent.scrollWidth > parent.clientWidth + 2 && crossesX) scrollable = true;
        if (/hidden|clip/.test(s.overflowX) && crossesX) reason = `clipped-by-${label(parent)}-x`;
        if (/hidden|clip/.test(s.overflowY) && crossesY) reason = `clipped-by-${label(parent)}-y`;
      }
      const s = getComputedStyle(el);
      if (s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 2) reason = "ellipsis-truncates-informative-text";
      if (!reason) return;
      const selector = label(el);
      const key = `${selector}:${content}:${reason}`;
      if (seenIssues.has(key)) return;
      seenIssues.add(key);
      const issue = { selector, text: content.slice(0, 160), reason, rect: rect(r) };
      // An intentionally scrollable strip is reachable, unlike overflow:hidden.
      const marquee = el.closest("[data-marquee]");
      const bounds = marquee?.getBoundingClientRect();
      // The requested cycling strip necessarily crops entering/leaving labels.
      // Retain those candidates separately, but never waive vertical clipping,
      // a strip outside the page, filters, or other overflow-hidden elements.
      if (bounds && bounds.left >= -2 && bounds.right <= innerWidth + 2
        && reason === `clipped-by-${label(marquee!)}-x`) ticker.push(issue);
      else if (scrollable && reason === "outside-horizontal-viewport") reachable.push(issue);
      else clipping.push(issue);
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const content = node.textContent ?? "";
      const el = node.parentElement;
      if (!content.trim() || !el || !visible(el)) continue;
      const range = document.createRange();
      range.setStart(node, content.search(/\S/));
      range.setEnd(node, content.trimEnd().length);
      const allRects = [...range.getClientRects()].filter((r) => r.width && r.height);
      for (const r of allRects) recordClipping(el, content.trim(), r);
      // Background sampling only covers portions actually painted within clipping
      // ancestors. Hidden marquee items must not sample unrelated visible content.
      const live = allRects.flatMap((r) => {
        let left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
        let top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
        for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const s = getComputedStyle(parent), p = parent.getBoundingClientRect();
          if (/hidden|clip|auto|scroll/.test(s.overflowX)) { left = Math.max(left, p.left); right = Math.min(right, p.right); }
          if (/hidden|clip|auto|scroll/.test(s.overflowY)) { top = Math.max(top, p.top); bottom = Math.min(bottom, p.bottom); }
        }
        return right > left && bottom > top ? [new DOMRect(left, top, right - left, bottom - top)] : [];
      });
      if (!live.length) continue;
      const style = getComputedStyle(el);
      const unsupported = new Set<string>();
      let opacity = 1;
      for (let parent: Element | null = el; parent; parent = parent.parentElement) {
        const s = getComputedStyle(parent);
        opacity *= Number(s.opacity);
        if (s.mixBlendMode !== "normal") unsupported.add(`mix-blend-mode:${s.mixBlendMode}`);
        if (s.filter !== "none") unsupported.add(`filter:${s.filter}`);
      }
      const fill = style.getPropertyValue("-webkit-text-fill-color") || style.color;
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = fill;
      paint.fillRect(0, 0, 1, 1);
      const foreground = [...paint.getImageData(0, 0, 1, 1).data];
      if (!foreground[3]) unsupported.add("transparent-or-gradient-text-fill");
      if (el.namespaceURI === "http://www.w3.org/2000/svg") unsupported.add("svg-text-fill-needs-manual-check");
      el.setAttribute("data-qa-text", "");
      text.push({ selector: label(el), text: content.trim().slice(0, 200), readingZone: !!el.closest("[data-reading]"), rects: live.map(rect), foreground, opacity, unsupported: [...unsupported] });
    }
    for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"]')) {
      if (!visible(el)) continue;
      recordClipping(el, el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName, el.getBoundingClientRect());
    }
    return { text, clipping, reachable, ticker };
  });
}

async function decode(path: string) {
  return sharp(path).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
}
type RawImage = Awaited<ReturnType<typeof decode>>;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
}

function luminance(rgb: number[]): number {
  const linear = rgb.map((v) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastSamples(text: TextSample[], background: RawImage): ContrastResult[] {
  const { data, info } = background;
  return text.map((sample) => {
    const ratios: number[] = [];
    const alpha = sample.foreground[3] / 255 * sample.opacity;
    for (const r of sample.rects) {
      const left = Math.max(0, Math.ceil(r.x));
      const top = Math.max(0, Math.ceil(r.y));
      const right = Math.min(info.width, Math.floor(r.x + r.width));
      const bottom = Math.min(info.height, Math.floor(r.y + r.height));
      // Sample inside every actual text-line range, not its distant parent box.
      const stride = Math.max(1, Math.ceil(Math.sqrt(Math.max(0, right - left) * Math.max(0, bottom - top) / 3000)));
      for (let y = top; y < bottom; y += stride) for (let x = left; x < right; x += stride) {
        const offset = (y * info.width + x) * info.channels;
        const bg = [data[offset], data[offset + 1], data[offset + 2]];
        const fg = bg.map((v, i) => sample.foreground[i] * alpha + v * (1 - alpha));
        const a = luminance(fg);
        const b = luminance(bg);
        ratios.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
      }
    }
    ratios.sort((a, b) => a - b);
    const unsupported = [...sample.unsupported];
    if (!ratios.length) unsupported.push("no-in-viewport-background-samples");
    const minRatio = ratios.length ? ratios[0] : null;
    return {
      selector: sample.selector, text: sample.text, readingZone: sample.readingZone,
      foreground: sample.foreground, effectiveOpacity: alpha, rects: sample.rects,
      samples: ratios.length, minRatio, p05Ratio: ratios.length ? percentile(ratios, 0.05) : null,
      // Worst sampled pixel is the strict criterion; p05 is diagnostic, not a waiver.
      passes: unsupported.length ? null : minRatio !== null && minRatio >= 4.5,
      unsupported,
    };
  });
}

function pixelMad(a: RawImage, b: RawImage): number {
  if (a.info.width !== b.info.width || a.info.height !== b.info.height || a.info.channels !== b.info.channels) {
    throw new Error("Seam frame dimensions changed; raw-pixel MAD would be invalid");
  }
  let total = 0;
  for (let i = 0; i < a.data.length; i++) total += Math.abs(a.data[i] - b.data[i]);
  return total / a.data.length / 255;
}

function robustBaseline(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5);
  const deviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const medianAbsoluteDeviation = percentile(deviations, 0.5);
  // Both relative-to-typical and robust noise criteria must be exceeded. The one
  // RGB code-value floor prevents near-black numerical noise becoming a "seam".
  const threshold = Math.max(median * 3, median + 6 * 1.4826 * medianAbsoluteDeviation, 1 / 255);
  return { median, medianAbsoluteDeviation, threshold };
}

function seamGraph(result: SeamResult): string {
  const width = 1100, height = 390, left = 75, right = 25, top = 35, bottom = 65;
  const plotW = width - left - right, plotH = height - top - bottom;
  const maxY = Math.max(0.01, ...result.deltas.flatMap((d) => [d.fullMad, d.canvasMad]), result.fullBaseline?.threshold ?? 0, result.canvasBaseline?.threshold ?? 0) * 1.15;
  const x = (progress: number) => left + progress * plotW;
  const y = (mad: number) => top + (1 - mad / maxY) * plotH;
  const line = (field: "fullMad" | "canvasMad", color: string) => `<polyline fill="none" stroke="${color}" stroke-width="2" points="${result.deltas.map((d) => `${x(d.progress).toFixed(2)},${y(d[field]).toFixed(2)}`).join(" ")}"/>`;
  const grid = Array.from({ length: 6 }, (_, i) => {
    const value = maxY * i / 5;
    return `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#ddd"/><text x="${left - 8}" y="${y(value) + 4}" text-anchor="end">${(value * 100).toFixed(2)}</text>`;
  }).join("");
  const ticks = Array.from({ length: 11 }, (_, i) => `<text x="${x(i / 10)}" y="${height - bottom + 24}" text-anchor="middle">${i * 10}%</text>`).join("");
  const thresholds = [[result.fullBaseline?.threshold, "#245db0"], [result.canvasBaseline?.threshold, "#bb5800"]] as const;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="12" fill="#222">${grid}${ticks}<line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#222"/>${thresholds.map(([v, c]) => v === undefined ? "" : `<line x1="${left}" y1="${y(v)}" x2="${width - right}" y2="${y(v)}" stroke="${c}" stroke-dasharray="5 5"/>`).join("")}${line("fullMad", "#245db0")}${line("canvasMad", "#bb5800")}${result.deltas.filter((d) => d.canvasSpike).map((d) => `<circle cx="${x(d.progress)}" cy="${y(d.canvasMad)}" r="4" fill="#c22"/>`).join("")}<text x="${left}" y="20">Decoded RGB MAD: blue = composited viewport; orange = isolated WebGL canvas; dashed = adaptive thresholds</text><text x="${width / 2}" y="${height - 10}" text-anchor="middle">Actual scroll progress (scrollY / maxScroll)</text><text transform="translate(17 ${height / 2}) rotate(-90)" text-anchor="middle">Mean absolute pixel difference (%)</text></g></svg>`;
}

async function captureCanvas(canvas: Locator, path: string): Promise<void> {
  await canvas.screenshot({ path, type: "png", scale: "css", animations: "allow", style: canvasOnly, timeout: 10000 });
}

async function seamTest(page: Page, folder: string): Promise<SeamResult> {
  const frames: Frame[] = [];
  const result: SeamResult = { status: "incomplete", frames, deltas: [] };
  await mkdir(join(out, folder), { recursive: true });
  const candidates = page.locator(canvasSelector);
  let selected = -1;
  let largestArea = 0;
  for (let i = 0; i < await candidates.count(); i++) {
    const box = await candidates.nth(i).boundingBox();
    if (box && box.width * box.height > largestArea) { selected = i; largestArea = box.width * box.height; }
  }
  if (selected < 0) { result.reason = "No live WebGL canvas; a poster/fallback cannot certify world seams"; return result; }
  const canvas = candidates.nth(selected);
  if (!await scrollToProgress(page, 0)) { result.reason = "Could not reach start of steady scroll"; return result; }
  const before = await metrics(page);
  if (before.maxScroll <= 0) { result.reason = "Page has no vertical scroll range"; return result; }
  // Calibrate the screenshot pair cost, then scroll continuously via wall-clock
  // rAF, not scroll-jump/screenshot/wait steps. Decode AFTER acquisition.
  const costs: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    await page.screenshot({ scale: "css", animations: "allow" });
    await canvas.screenshot({ scale: "css", animations: "allow", style: canvasOnly });
    costs.push(performance.now() - start);
  }
  const count = Math.ceil(envNumber("QA_SEAM_FRAMES", 81, 81));
  const duration = Math.max(envNumber("QA_SEAM_SECONDS", 24, 1) * 1000, (Math.max(...costs) + 60) * count * 1.7);
  result.durationMs = duration;
  const start = await page.evaluate((durationMs) => {
    const state = { start: performance.now() + 150, duration: durationMs, maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight), raf: 0 };
    (window as QAWindow).__portfolioQA = state;
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - state.start) / state.duration));
      window.scrollTo({ top: progress * state.maxScroll, left: 0, behavior: "instant" });
      if (progress < 1) state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
    return state.start;
  }, duration);
  try {
    for (let i = 0; i < count; i++) {
      const deadline = start + duration * i / (count - 1);
      await page.evaluate((target) => new Promise<void>((done) => {
        const wait = () => performance.now() >= target ? done() : requestAnimationFrame(wait);
        wait();
      }), deadline);
      const stem = String(i).padStart(3, "0");
      const full = join(folder, `${stem}-full.png`);
      const isolated = join(folder, `${stem}-canvas.png`);
      const fullMetrics = await metrics(page);
      // "Full" = full composited VIEWPORT, not a stitched tall-document image:
      // stitching a fixed canvas across the document would invalidate this test.
      await page.screenshot({ path: join(out, full), fullPage: false, scale: "css", animations: "allow" });
      const canvasMetrics = await metrics(page);
      await captureCanvas(canvas, join(out, isolated));
      frames.push({ index: i, full, canvas: isolated, fullMetrics, canvasMetrics });
    }
  } finally {
    await page.evaluate(() => {
      const state = (window as QAWindow).__portfolioQA;
      if (state) cancelAnimationFrame(state.raf);
    });
    // Raw frame metrics survive even if a later decode/analysis fails.
    await saveJson(join(folder, "frames.json"), frames);
  }
  let previousFull = await decode(join(out, frames[0].full));
  let previousCanvas = await decode(join(out, frames[0].canvas));
  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i], previous = frames[i - 1];
    const full = await decode(join(out, frame.full));
    const isolated = await decode(join(out, frame.canvas));
    const boundaryIds = (m: Metrics) => new Set(m.readingZones.filter((r) => r.crossesViewport).map((r) => r.id));
    const a = boundaryIds(previous.fullMetrics), b = boundaryIds(frame.fullMetrics);
    result.deltas.push({
      frame: i, progress: frame.canvasMetrics.progress, scrollY: frame.canvasMetrics.scrollY,
      elapsedMs: frame.canvasMetrics.time - previous.canvasMetrics.time,
      scrollStep: frame.canvasMetrics.scrollY - previous.canvasMetrics.scrollY,
      fullMad: pixelMad(previousFull, full), canvasMad: pixelMad(previousCanvas, isolated),
      textBoundaryChanges: [...new Set([...a, ...b])].filter((id) => a.has(id) !== b.has(id)),
      fullSpike: false, canvasSpike: false, classification: "typical",
    });
    previousFull = full;
    previousCanvas = isolated;
  }
  result.fullBaseline = robustBaseline(result.deltas.map((d) => d.fullMad));
  result.canvasBaseline = robustBaseline(result.deltas.map((d) => d.canvasMad));
  for (let i = 0; i < result.deltas.length; i++) {
    const delta = result.deltas[i];
    // A smoothly brighter/more active part of the world is not an abrupt seam.
    // Require a spike relative to BOTH the full run and its nearby frames.
    const neighbours = result.deltas.slice(Math.max(0, i - 5), i + 6).filter((d) => d !== delta);
    delta.fullLocalThreshold = robustBaseline(neighbours.map((d) => d.fullMad)).threshold;
    delta.canvasLocalThreshold = robustBaseline(neighbours.map((d) => d.canvasMad)).threshold;
    delta.fullSpike = delta.fullMad > Math.max(result.fullBaseline.threshold, delta.fullLocalThreshold);
    delta.canvasSpike = delta.canvasMad > Math.max(result.canvasBaseline.threshold, delta.canvasLocalThreshold);
    delta.classification = delta.canvasSpike ? "suspected-world-seam" : delta.fullSpike ? "text-or-layout-not-world-seam" : "typical";
  }
  const positions = frames.map((f) => f.canvasMetrics.scrollY);
  const gaps = result.deltas.map((d) => d.scrollStep / before.maxScroll).sort((a, b) => a - b);
  const distinctPositions = new Set(positions.map((p) => Math.round(p))).size;
  const startProgress = frames[0].canvasMetrics.progress;
  const endProgress = frames.at(-1)!.canvasMetrics.progress;
  const maxGap = Math.max(...gaps), medianGap = percentile(gaps, 0.5);
  const adequate = distinctPositions >= 80 && startProgress <= 0.03 && endProgress >= 0.99 && maxGap <= Math.max(0.04, medianGap * 2.5)
    && frames.every((f) => Math.abs(f.canvasMetrics.maxScroll - before.maxScroll) <= 3);
  result.sampling = { distinctPositions, startProgress, endProgress, maxGap, medianGap, adequate };
  result.status = adequate ? "complete" : "incomplete";
  if (!adequate) result.reason = "Insufficient/uneven scroll coverage or changing maxScroll; increase QA_SEAM_SECONDS before interpreting spikes";
  await saveJson(join(folder, "seams.json"), result);
  await writeFile(join(out, folder, "seams.svg"), seamGraph(result), "utf8");
  return result;
}

async function runViewport(browser: Browser, width: number, height: number, screenshots: boolean): Promise<void> {
  const viewport = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const run: Run = { viewport: { width, height }, checkpoints: [] };
  runs.push(run);
  let stage = "load";
  const event = (kind: string, message: string, extra: Partial<EventRecord> = {}) => events.push({ at: new Date().toISOString(), viewport, stage, kind, message, ...extra });
  page.on("console", (message) => event(`console:${message.type()}`, message.text(), { location: message.location() }));
  page.on("pageerror", (error) => event("pageerror", error.stack ?? error.message));
  page.on("requestfailed", (request) => event("requestfailed", request.failure()?.errorText ?? "Request failed", { url: request.url() }));
  page.on("response", (response) => { if (response.status() >= 400) event("http-error", `${response.status()} ${response.statusText()}`, { url: response.url() }); });
  try {
    // Observe real context creation, don't allocate WebGL contexts on 2D previews.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
        const context = Reflect.apply(original, this, args);
        if (context && /^webgl2?$|^experimental-webgl$/.test(String(args[0]))) this.setAttribute("data-qa-webgl", "");
        return context;
      };
    });
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForTimeout(3200); // Idle-loaded canvas and initial title reveal.
    if (screenshots) {
      await mkdir(join(out, "screenshots", viewport), { recursive: true });
      await mkdir(join(out, "contrast-backgrounds", viewport), { recursive: true });
    }
    for (let percent = 0; percent <= 100; percent += 10) {
      stage = `checkpoint:${percent}%`;
      const scrollReached = await scrollToProgress(page, percent / 100);
      // Freeze only the moving HTML labels while bounds and the two contrast
      // screenshots are acquired. WebGL, scrub, and the seam run remain live.
      const freeze = await page.addStyleTag({ content: "[data-marquee-track] { animation-play-state: paused !important; }" });
      const inspected = await inspectTextAndGeometry(page);
      const checkpoint: Checkpoint = {
        requestedProgress: percent / 100, metrics: await metrics(page), scrollReached,
        clipping: inspected.clipping, reachableHorizontalScroll: inspected.reachable,
        intentionalTickerClipping: inspected.ticker,
      };
      run.checkpoints.push(checkpoint);
      if (screenshots) {
        const stem = `${String(percent).padStart(3, "0")}.png`;
        checkpoint.screenshot = join("screenshots", viewport, stem);
        checkpoint.backgroundScreenshot = join("contrast-backgrounds", viewport, stem);
        await page.screenshot({ path: join(out, checkpoint.screenshot), scale: "css", animations: "allow" });
        checkpoint.backgroundMetrics = await metrics(page);
        await page.screenshot({ path: join(out, checkpoint.backgroundScreenshot), scale: "css", animations: "allow", style: transparentText });
        checkpoint.contrast = contrastSamples(inspected.text, await decode(join(out, checkpoint.backgroundScreenshot)));
      }
      await freeze.evaluate((element) => element.parentNode?.removeChild(element));
      // Persist each completed checkpoint, not just the eventual final report.
      await saveJson(`checks-${viewport}.json`, run);
    }
    if (screenshots) {
      stage = "steady-scroll-seams";
      run.seam = await seamTest(page, join("seams", viewport));
      await saveJson(join("seams", viewport, "seams.json"), run.seam);
      await saveJson(`checks-${viewport}.json`, run);
    }
  } finally {
    await context.close();
    await saveJson("events.json", events);
  }
}

async function report(fatal?: string): Promise<void> {
  const checkpoints = runs.flatMap((r) => r.checkpoints);
  const contrast = checkpoints.flatMap((c) => c.contrast ?? []);
  const failedContrast = contrast.filter((c) => c.passes === false);
  const unsupportedContrast = contrast.filter((c) => c.passes === null);
  const geometryFailures = checkpoints.filter((c) => c.metrics.horizontalOverflow > 2 || c.clipping.length > 0 || !c.scrollReached);
  const seams = runs.flatMap((r) => r.seam ? [{ viewport: r.viewport, ...r.seam }] : []);
  const worldSpikes = seams.flatMap((s) => s.deltas.filter((d) => d.canvasSpike).map((d) => ({ viewport: s.viewport, ...d })));
  const textSpikes = seams.flatMap((s) => s.deltas.filter((d) => d.fullSpike && !d.canvasSpike).map((d) => ({ viewport: s.viewport, ...d })));
  const runtimeErrors = events.filter((e) => ["console:error", "pageerror", "http-error", "requestfailed"].includes(e.kind));
  const incomplete = !!fatal || seams.length !== 2 || seams.some((s) => s.status !== "complete") || unsupportedContrast.length > 0 || !contrast.length || checkpoints.length !== 55;
  const failed = geometryFailures.length > 0 || failedContrast.length > 0 || worldSpikes.length > 0 || runtimeErrors.length > 0;
  const status = fatal ? "error" : failed ? "failed" : incomplete ? "incomplete" : "automated-checks-passed-manual-review-required";
  const summary = {
    status, startedAt, finishedAt: new Date().toISOString(), url, out, fatal,
    browser: browserInfo,
    counts: { checkpoints: checkpoints.length, screenshots: checkpoints.filter((c) => c.screenshot).length, geometryFailures: geometryFailures.length, contrastSamples: contrast.length, contrastFailures: failedContrast.length, unsupportedContrast: unsupportedContrast.length, suspectedWorldSeams: worldSpikes.length, textOrLayoutSpikes: textSpikes.length, runtimeErrors: runtimeErrors.length },
    contrastMethod: "Computed text fill + cumulative opacity over sampled sRGB pixels from a separate text-transparent screenshot. HTML marquee tracks pause during bounds/capture to prevent icons moving into stale text ranges; WebGL remains live. Strict sampled minimum >=4.5; p05 diagnostic only. Adjacent world captures are not the same animation instant.",
    seamMethod: "Continuous time-based scroll; decoded full-resolution RGB mean absolute difference /255. Full = composited viewport; canvas = locator screenshot with overlapping HTML hidden, DOM boxes preserved. Adaptive global AND local median/MAD thresholds reject smooth changes in scene activity. Canvas spikes are suspects, not proof; HTML-only spikes do not certify a world seam.",
    geometryMethod: "All 10% checkpoints at 375/390/768/1440/1920. Natural vertical viewport crossings are not clipping. Reachable overflow:auto/scroll strips and requested cycling marquee edge labels are reported separately; marquee containers must fit the viewport and no vertical clipping is waived. aria-hidden, disabled and invisible text excluded.",
    performance: { lighthouse: "not-run", fps: "not-measured", cls: "not-measured" },
    manualReviewRequired: ["Inspect all 22 screenshots for rectangular shader artifacts and banding", "Inspect suspected world-seam pairs and their canvas-only frames", "Confirm no foreground occlusion, unusual blend/filter text, or tiny bright areas between contrast sample grid points", "Review typography, wrapping and all clipped-element candidates; this script does not replace visual inspection"],
    runs,
  };
  await saveJson("events.json", events);
  await saveJson("summary.json", summary);
  const lines = [
    `# Portfolio QA — ${status}`, "", `URL: ${url}`, `Output: ${out}`, "",
    `- Checkpoints: ${checkpoints.length}/55; screenshots: ${summary.counts.screenshots}/22.`,
     `- Geometry failures: ${geometryFailures.length}; contrast failures: ${failedContrast.length}; unsupported text: ${unsupportedContrast.length}.`,
     `- Intentional cycling-strip candidates: ${checkpoints.reduce((sum, c) => sum + c.intentionalTickerClipping.length, 0)} (retained separately, not layout failures).`,
    `- Suspected canvas seams: ${worldSpikes.length}; HTML-only changes (not world seams): ${textSpikes.length}.`,
    `- Runtime/network errors: ${runtimeErrors.length}; see events.json (all console levels retained).`,
    "- Lighthouse / FPS / CLS: not measured; no scores substituted.", "",
    "## Seam graphs", ...seams.map((s) => `- [${s.viewport.width}×${s.viewport.height}](seams/${s.viewport.width}x${s.viewport.height}/${s.deltas.length ? "seams.svg" : "seams.json"}): ${s.status}${s.reason ? ` — ${s.reason}` : ""}.`), "",
    "## Suspected world seams", ...worldSpikes.map((d) => `- ${d.viewport.width}×${d.viewport.height}, frame ${d.frame}, ${(d.progress * 100).toFixed(1)}%: canvas MAD ${(d.canvasMad * 100).toFixed(3)}%; scroll step ${d.scrollStep.toFixed(1)}px / ${d.elapsedMs.toFixed(0)}ms.`), "",
    "## Contrast failures (worst first)", ...[...failedContrast].sort((a, b) => a.minRatio! - b.minRatio!).slice(0, 30).map((c) => `- ${JSON.stringify(c.text)}: min ${c.minRatio!.toFixed(2)}:1; p05 ${c.p05Ratio!.toFixed(2)}:1; ${c.selector}.`), "",
    "## Manual review still required", ...summary.manualReviewRequired.map((s) => `- ${s}`),
  ];
  if (fatal) lines.push("", "## Fatal error", "```text", fatal, "```");
  await writeFile(join(out, "summary.md"), lines.join("\n") + "\n", "utf8");
  process.exitCode = fatal ? 2 : failed || incomplete ? 1 : 0;
  console.log(`QA: ${status}; ${join(out, "summary.md")}`);
}

let browserInfo: { executablePath: string; version?: string } | undefined;

async function main(): Promise<void> {
  await mkdir(out, { recursive: true });
  let browser: Browser | undefined;
  let fatal: string | undefined;
  try {
    const { chromium } = await import("playwright").catch(() => {
      throw new Error("Missing devDependency playwright. Add it before running QA; this script does not install dependencies.");
    });
    const bundled = chromium.executablePath();
    const executablePath = process.env.QA_CHROME ?? (existsSync(bundled) ? bundled : "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
    if (!existsSync(executablePath)) throw new Error(`No Chromium executable at ${executablePath}; set QA_CHROME or install a Playwright browser separately`);
    browserInfo = { executablePath };
    browser = await chromium.launch({ executablePath, headless: true });
    browserInfo.version = browser.version();
    for (const [width, height, screenshots] of [[1440, 900, true], [390, 844, true], [375, 844, false], [768, 1024, false], [1920, 1080, false]] as const) {
      await runViewport(browser, width, height, screenshots);
    }
  } catch (error) {
    fatal = error instanceof Error ? error.stack ?? error.message : String(error);
  } finally {
    try { await browser?.close(); } catch (error) { fatal ??= String(error); }
    await report(fatal);
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 2;
});
