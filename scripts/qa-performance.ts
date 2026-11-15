/**
 * Measure an ALREADY built/served static export; never builds or installs anything.
 *   node --experimental-strip-types scripts/qa-performance.ts
 * QA_URL / QA_OUT / QA_CHROME override the defaults below. System Chrome, headed,
 * is preferred for real GPU use; QA_HEADLESS=1 is optional (renderer is reported).
 * QA_WARMUP_SECONDS >=15 (default 15), QA_SAMPLE_SECONDS >=15 (default 20).
 * No screenshots, videos, Lighthouse run, tracing or scene/style modifications.
 * RAF callback throughput is NOT proof of GPU-rendered/presented frame rate.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Browser, Page } from "playwright";

type Entry = {
  name: string; startTime: number; duration: number;
  value?: number; hadRecentInput?: boolean; size?: number;
};
type CanvasState = {
  width: number; height: number; cssWidth: number; cssHeight: number;
  visible: boolean; contextObserved: boolean; contextLost: boolean | null;
  exposedQuality: string | null; exposedRendering: string | null;
};
type SceneState = {
  time: number; scrollY: number; maxScroll: number; progress: number;
  visibility: DocumentVisibilityState; fonts: FontFaceSetLoadStatus;
  viewport: { width: number; height: number }; dpr: number;
  canvasCount: number; canvas: CanvasState | null;
};
type Hardware = {
  status: "available" | "unavailable"; reason?: string;
  vendor?: string; renderer?: string; version?: string;
  unmaskedVendor?: string; unmaskedRenderer?: string;
  rendererClassification: "software" | "not-obviously-software" | "unknown";
};
type Instrumentation = {
  entries: Record<string, Entry[]>;
  supported: string[]; observerErrors: string[];
  contexts: WeakMap<HTMLCanvasElement, WebGLRenderingContext | WebGL2RenderingContext>;
  contextEvents: { time: number; kind: string }[];
  flush: () => void; scene: () => SceneState;
};
type QAWindow = Window & { __portfolioPerformance?: Instrumentation };
type RawSample = {
  startTime: number; sampleStart: number; endTime: number;
  intervals: { endMs: number; intervalMs: number }[];
  snapshots: SceneState[];
  canvasMutations: { time: number; attribute: string | null }[];
  completedBy: "timer";
};
type FrameStats = {
  intervalCount: number; elapsedMs: number; observedIntervalMs: number;
  medianIntervalMs: number | null; p90IntervalMs: number | null;
  medianFps: number | null; p10Fps: number | null;
  throughputFps: number | null; slowFrameShare: number | null;
  over50msShare: number | null;
};
type Phase = {
  name: string; target: { scrollY: number; progress: number; source: string };
  hardwareBefore: Hardware; hardwareAfter: Hardware;
  raw: RawSample; stats: FrameStats; first5s: FrameStats; last5s: FrameStats;
  validationIssues: string[]; adequate: boolean; goalFps: number;
  proxyGoalPassed: boolean | null;
  longTasks: { supported: boolean; count: number | null; totalMs: number | null; blockingMs: number | null };
};
type Vitals = {
  supported: string[]; observerErrors: string[]; entries: Record<string, Entry[]>;
  contextEvents: { time: number; kind: string }[];
  fcpMs: number | null; lastObservedLcpMs: number | null;
  cls: number | null; layoutShiftSum: number | null;
};
type Profile = {
  name: string; viewport: { width: number; height: number };
  cpuThrottle: number; isMobile: boolean; deviceScaleFactor: number; goalFps: number;
};
type Run = {
  profile: Profile; phases: Phase[]; vitals?: Vitals; loadVitals?: Vitals;
  fatal?: string; cpuThrottleApplied: boolean;
};
type EventRecord = { at: string; profile: string; stage: string; kind: string; message: string; url?: string };

const url = process.env.QA_URL ?? "http://127.0.0.1:4173/portfolio/";
const out = resolve(process.env.QA_OUT ?? "C:\\Users\\REDMI\\AppData\\Local\\Temp\\opencode\\portfolio-qa-phase-b");
const canvasSelector = "canvas[data-qa-webgl]";
const startedAt = new Date().toISOString();
const runs: Run[] = [];
const events: EventRecord[] = [];
const profiles: Profile[] = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, cpuThrottle: 1, isMobile: false, deviceScaleFactor: 1, goalFps: 55 },
  { name: "mobile", viewport: { width: 390, height: 844 }, cpuThrottle: 4, isMobile: true, deviceScaleFactor: 1, goalFps: 30 },
];

function seconds(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < 15) throw new Error(`${name} must be >=15 seconds`);
  return value * 1000;
}

async function save(name: string, value: unknown): Promise<void> {
  await writeFile(join(out, name), JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function instrument(page: Page): Promise<void> {
  await page.addInitScript((selector) => {
    const state: Instrumentation = {
      entries: {}, supported: [...PerformanceObserver.supportedEntryTypes], observerErrors: [],
      contexts: new WeakMap(), contextEvents: [], flush: () => {}, scene: readScene,
    };
    (window as QAWindow).__portfolioPerformance = state;
    const original = HTMLCanvasElement.prototype.getContext;
    // Retain contexts the APP actually creates. Never probe getContext on a canvas
    // that might be a 2D fallback, and never allocate an additional GL canvas.
    HTMLCanvasElement.prototype.getContext = function (...args: unknown[]) {
      const context = Reflect.apply(original, this, args);
      if (context && /^(webgl2?|experimental-webgl)$/.test(String(args[0]))) {
        if (!state.contexts.has(this)) {
          this.addEventListener("webglcontextlost", () => state.contextEvents.push({ time: performance.now(), kind: "lost" }));
          this.addEventListener("webglcontextrestored", () => state.contextEvents.push({ time: performance.now(), kind: "restored" }));
        }
        state.contexts.set(this, context);
      }
      return context;
    };
    const observers: { observer: PerformanceObserver; collect: (entries: PerformanceEntry[]) => void }[] = [];
    for (const type of ["paint", "largest-contentful-paint", "longtask", "layout-shift"]) {
      state.entries[type] = [];
      if (!state.supported.includes(type)) continue;
      const collect = (entries: PerformanceEntry[]) => {
        for (const entry of entries) {
          const extra = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean; size?: number };
          state.entries[type].push({ name: entry.name, startTime: entry.startTime, duration: entry.duration,
            value: extra.value, hadRecentInput: extra.hadRecentInput, size: extra.size });
        }
      };
      try {
        const observer = new PerformanceObserver((list) => collect(list.getEntries()));
        observer.observe({ type, buffered: true });
        observers.push({ observer, collect });
      } catch (error) { state.observerErrors.push(`${type}: ${String(error)}`); }
    }
    state.flush = () => observers.forEach(({ observer, collect }) => collect(observer.takeRecords()));
    function readScene(): SceneState {
      const canvases = document.querySelectorAll<HTMLCanvasElement>(selector);
      const canvas = canvases[0];
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      let observed: CanvasState | null = null;
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        let visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
        for (let node: Element | null = canvas; visible && node; node = node.parentElement) {
          const s = getComputedStyle(node);
          visible = s.display !== "none" && s.visibility === "visible" && Number(s.opacity) > 0;
        }
        const wrapper = canvas.closest("[data-world-canvas]");
        const context = state.contexts.get(canvas);
        observed = {
          width: canvas.width, height: canvas.height, cssWidth: r.width, cssHeight: r.height, visible,
          contextObserved: !!context, contextLost: context ? context.isContextLost() : null,
          exposedQuality: canvas.getAttribute("data-qa-quality") ?? wrapper?.getAttribute("data-qa-quality") ?? null,
          exposedRendering: canvas.getAttribute("data-qa-rendering") ?? wrapper?.getAttribute("data-qa-rendering") ?? null,
        };
      }
      return { time: performance.now(), scrollY, maxScroll, progress: maxScroll ? scrollY / maxScroll : 0,
        visibility: document.visibilityState, fonts: document.fonts.status,
        viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio,
        canvasCount: canvases.length, canvas: observed };
    }
  }, canvasSelector);
}

async function hardware(page: Page): Promise<Hardware> {
  return page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector);
    const context = canvas && (window as QAWindow).__portfolioPerformance?.contexts.get(canvas);
    if (!context || context.isContextLost()) return { status: "unavailable", reason: "No observed live app WebGL context", rendererClassification: "unknown" };
    try {
      const extension = context.getExtension("WEBGL_debug_renderer_info");
      const unmaskedRenderer = extension ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : undefined;
      return {
        status: "available", vendor: String(context.getParameter(context.VENDOR)),
        renderer: String(context.getParameter(context.RENDERER)), version: String(context.getParameter(context.VERSION)),
        unmaskedVendor: extension ? String(context.getParameter(extension.UNMASKED_VENDOR_WEBGL)) : undefined,
        unmaskedRenderer, reason: extension ? undefined : "WEBGL_debug_renderer_info unavailable; hardware cannot be identified",
        rendererClassification: !unmaskedRenderer ? "unknown" : /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(unmaskedRenderer) ? "software" : "not-obviously-software",
      };
    } catch (error) { return { status: "unavailable", reason: String(error), rendererClassification: "unknown" }; }
  }, canvasSelector);
}

async function vitals(page: Page): Promise<Vitals> {
  const data = await page.evaluate(() => {
    const state = (window as QAWindow).__portfolioPerformance;
    if (!state) throw new Error("Performance instrumentation missing");
    state.flush();
    return { supported: state.supported, observerErrors: state.observerErrors, entries: state.entries, contextEvents: state.contextEvents };
  });
  const shifts = data.entries["layout-shift"].filter((entry) => !entry.hadRecentInput).sort((a, b) => a.startTime - b.startTime);
  let cls = 0, session = 0, sessionStart = -Infinity, previous = -Infinity;
  for (const entry of shifts) {
    if (entry.startTime - previous >= 1000 || entry.startTime - sessionStart >= 5000) {
      session = 0; sessionStart = entry.startTime;
    }
    session += entry.value ?? 0;
    cls = Math.max(cls, session);
    previous = entry.startTime;
  }
  const lcp = data.entries["largest-contentful-paint"];
  const clsSupported = data.supported.includes("layout-shift") && !data.observerErrors.some((e) => e.startsWith("layout-shift:"));
  return { ...data,
    fcpMs: data.entries.paint.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null,
    lastObservedLcpMs: lcp.length ? lcp[lcp.length - 1].startTime : null,
    cls: clsSupported ? cls : null,
    layoutShiftSum: clsSupported ? shifts.reduce((sum, entry) => sum + (entry.value ?? 0), 0) : null,
  };
}

async function target(page: Page, name: string): Promise<Phase["target"]> {
  const position = await page.evaluate((phase) => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    if (!maxScroll) throw new Error("No vertical scroll range");
    let top = 0;
    if (phase === "dive") top = innerHeight * 0.4;
    if (phase === "stack" || phase === "garden") {
      const element = document.getElementById(phase);
      if (!element) throw new Error(`Missing #${phase}`);
      top = element.getBoundingClientRect().top + scrollY - innerHeight * 0.2;
    }
    top = Math.max(0, Math.min(maxScroll, top));
    window.scrollTo({ top, left: 0, behavior: "instant" });
    return { scrollY: top, progress: top / maxScroll, source: phase === "dive" ? "40% of initial viewport height, inside the hero dive on both profiles" : phase === "hero" ? "page top" : `#${phase} at 20% viewport (matches timeline calibration)` };
  }, name);
  await page.waitForFunction((top) => Math.abs(scrollY - top) <= 3, position.scrollY, { timeout: 5000, polling: 100 });
  return position;
}

async function sample(page: Page, warmupMs: number, durationMs: number): Promise<RawSample> {
  return page.evaluate(({ warmup, duration, selector }) => new Promise<RawSample>((resolveSample, reject) => {
    const state = (window as QAWindow).__portfolioPerformance;
    if (!state) { reject(new Error("Performance instrumentation missing")); return; }
    const startTime = performance.now(), sampleStart = startTime + warmup;
    const intervals: RawSample["intervals"] = [], snapshots: SceneState[] = [], canvasMutations: RawSample["canvasMutations"] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target as Element;
        if (element.matches(selector) || element.matches("[data-world-canvas]")) {
          canvasMutations.push({ time: performance.now(), attribute: record.attributeName });
        }
      }
    });
    observer.observe(document.documentElement, { subtree: true, attributes: true,
      attributeFilter: ["width", "height", "data-qa-quality", "data-qa-rendering"] });
    let previous: number | undefined, raf = 0;
    const tick = (now: number) => {
      // Keep only intervals entirely inside the measurement window. Warmup is
      // real elapsed time, not a fixed count of RAF callbacks on a slow machine.
      if (previous !== undefined && previous >= sampleStart && now <= sampleStart + duration) {
        intervals.push({ endMs: now - sampleStart, intervalMs: now - previous });
      }
      previous = now;
      raf = requestAnimationFrame(tick);
    };
    snapshots.push(state.scene());
    const poll = setInterval(() => snapshots.push(state.scene()), 1000);
    raf = requestAnimationFrame(tick);
    // A wall-clock timer still completes with zero RAFs in a hidden/stalled page;
    // empty samples are invalid, never converted to a passing FPS value.
    setTimeout(() => {
      cancelAnimationFrame(raf); clearInterval(poll); observer.disconnect();
      snapshots.push(state.scene());
      resolveSample({ startTime, sampleStart, endTime: performance.now(), intervals, snapshots, canvasMutations, completedBy: "timer" });
    }, warmup + duration);
  }), { warmup: warmupMs, duration: durationMs, selector: canvasSelector });
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p, low = Math.floor(index);
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
}

function frameStats(intervals: RawSample["intervals"], elapsedMs: number, goal: number): FrameStats {
  const values = intervals.map((s) => s.intervalMs).filter((ms) => Number.isFinite(ms) && ms > 0);
  const sorted = [...values].sort((a, b) => a - b);
  const fps = values.map((ms) => 1000 / ms).sort((a, b) => a - b);
  return { intervalCount: values.length, elapsedMs, observedIntervalMs: values.reduce((a, b) => a + b, 0),
    medianIntervalMs: percentile(sorted, 0.5), p90IntervalMs: percentile(sorted, 0.9),
    medianFps: percentile(fps, 0.5), p10Fps: percentile(fps, 0.1),
    throughputFps: values.length ? values.length * 1000 / elapsedMs : null,
    slowFrameShare: values.length ? values.filter((ms) => ms > 1000 / goal).length / values.length : null,
    over50msShare: values.length ? values.filter((ms) => ms > 50).length / values.length : null };
}

function validate(raw: RawSample, phaseTarget: Phase["target"], profile: Profile, durationMs: number): string[] {
  const issues: string[] = [];
  if (raw.intervals.length <= 60) issues.push("At least 61 real RAF intervals required");
  if (raw.intervals.some((s) => !Number.isFinite(s.intervalMs) || s.intervalMs <= 0)) issues.push("Invalid RAF interval");
  if (raw.endTime - raw.sampleStart < durationMs) issues.push("Measurement window shorter than requested");
  const relevant = raw.snapshots.filter((s) => s.time >= raw.sampleStart - 5000);
  if (relevant.length < Math.floor(durationMs / 1000)) issues.push("Insufficient scene/visibility snapshots");
  for (const s of relevant) {
    if (s.visibility !== "visible") issues.push("Page hidden during warmup tail or sample");
    if (s.fonts !== "loaded") issues.push("Fonts still loading");
    if (s.canvasCount !== 1 || !s.canvas?.visible || !s.canvas.contextObserved || s.canvas.contextLost !== false || s.canvas.width <= 0 || s.canvas.height <= 0) issues.push("No single visible live app WebGL canvas (fallback cannot pass)");
    if (s.viewport.width !== profile.viewport.width || s.viewport.height !== profile.viewport.height) issues.push("Actual viewport does not match profile");
    if (Math.abs(s.scrollY - phaseTarget.scrollY) > 3) issues.push("Scroll position moved during sampling");
    if (s.canvas?.exposedRendering === "false" || s.canvas?.exposedRendering === "paused") issues.push("App reports paused rendering");
  }
  const signatures = relevant.map((s) => JSON.stringify([s.maxScroll, s.canvas?.width, s.canvas?.height, s.canvas?.exposedQuality]));
  if (new Set(signatures).size > 1) issues.push("Observable quality/canvas size or page height not stable for final 5s warmup + full sample");
  if (raw.canvasMutations.some((m) => m.time >= raw.sampleStart - 5000 && m.attribute !== "data-qa-rendering")) issues.push("Canvas backing size/exposed quality changed after settling deadline");
  return [...new Set(issues)];
}

async function runProfile(browser: Browser, profile: Profile, warmupMs: number, durationMs: number): Promise<void> {
  const run: Run = { profile, phases: [], cpuThrottleApplied: false };
  runs.push(run);
  const context = await browser.newContext({ viewport: profile.viewport, screen: profile.viewport,
    isMobile: profile.isMobile, hasTouch: profile.isMobile, deviceScaleFactor: profile.deviceScaleFactor, reducedMotion: "no-preference" });
  const page = await context.newPage();
  let stage = "load";
  const event = (kind: string, message: string, eventUrl?: string) => events.push({ at: new Date().toISOString(), profile: profile.name, stage, kind, message, url: eventUrl });
  page.on("pageerror", (error) => event("pageerror", error.stack ?? error.message));
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) event(`console:${message.type()}`, message.text()); });
  page.on("requestfailed", (request) => event("requestfailed", request.failure()?.errorText ?? "Request failed", request.url()));
  page.on("response", (response) => { if (response.status() >= 400) event("http-error", `${response.status()} ${response.statusText()}`, response.url()); });
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuThrottle });
    run.cpuThrottleApplied = true;
    await instrument(page);
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await page.waitForFunction((selector) => {
      const canvas = document.querySelector<HTMLCanvasElement>(selector);
      const gl = canvas && (window as QAWindow).__portfolioPerformance?.contexts.get(canvas);
      return !!canvas && !!gl && !gl.isContextLost() && canvas.width > 0 && canvas.height > 0;
    }, canvasSelector, { timeout: 45000, polling: 200 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    for (const name of ["hero", "dive", "stack", "garden"]) {
      stage = `${name}:warmup-and-sample`;
      const position = await target(page, name);
      const hardwareBefore = await hardware(page);
      const raw = await sample(page, warmupMs, durationMs);
      const hardwareAfter = await hardware(page);
      const measuredVitals = await vitals(page);
      if (name === "hero") run.loadVitals = measuredVitals;
      run.vitals = measuredVitals;
      const stats = frameStats(raw.intervals, raw.endTime - raw.sampleStart, profile.goalFps);
      const first5s = frameStats(raw.intervals.filter((s) => s.endMs <= 5000), 5000, profile.goalFps);
      const last5s = frameStats(raw.intervals.filter((s) => s.endMs > durationMs - 5000), 5000, profile.goalFps);
      const validationIssues = validate(raw, position, profile, durationMs);
      if (hardwareBefore.status !== "available" || hardwareAfter.status !== "available") validationIssues.push("WebGL hardware query unavailable because live context is missing/unreadable");
      if (measuredVitals.contextEvents.some((e) => e.kind === "lost" && e.time >= raw.startTime && e.time <= raw.endTime)) validationIssues.push("WebGL context lost during warmup/sample");
      if (first5s.intervalCount <= 60 || last5s.intervalCount <= 60) validationIssues.push("First/last 5s windows require >60 intervals each");
      const adequate = validationIssues.length === 0;
      const longtaskSupported = measuredVitals.supported.includes("longtask") && !measuredVitals.observerErrors.some((e) => e.startsWith("longtask:"));
      const longtasks = measuredVitals.entries.longtask.filter((e) => e.startTime < raw.endTime && e.startTime + e.duration > raw.sampleStart);
      const phase: Phase = { name, target: position, hardwareBefore, hardwareAfter, raw, stats, first5s, last5s,
        validationIssues, adequate, goalFps: profile.goalFps,
        proxyGoalPassed: adequate ? stats.medianFps !== null && stats.medianFps >= profile.goalFps
          && stats.throughputFps !== null && stats.throughputFps >= profile.goalFps
          && last5s.throughputFps !== null && last5s.throughputFps >= profile.goalFps : null,
        longTasks: { supported: longtaskSupported, count: longtaskSupported ? longtasks.length : null,
          totalMs: longtaskSupported ? longtasks.reduce((sum, e) => sum + Math.max(0, Math.min(raw.endTime, e.startTime + e.duration) - Math.max(raw.sampleStart, e.startTime)), 0) : null,
          blockingMs: longtaskSupported ? longtasks.reduce((sum, e) => sum + Math.max(0, Math.min(raw.endTime, e.startTime + e.duration) - Math.max(raw.sampleStart, e.startTime + 50)), 0) : null } };
      run.phases.push(phase);
      await save(`performance-${profile.name}.json`, run);
      console.log(`${profile.name}/${name}: RAF throughput ${stats.throughputFps?.toFixed(1) ?? "unavailable"}; median ${stats.medianFps?.toFixed(1) ?? "unavailable"}; p10 ${stats.p10Fps?.toFixed(1) ?? "unavailable"}; ${adequate ? phase.proxyGoalPassed ? "proxy passed" : "proxy below goal" : "invalid sample"}`);
    }
    stage = "final-vitals";
    run.vitals = await vitals(page);
    await cdp.detach();
  } catch (error) { run.fatal = error instanceof Error ? error.stack ?? error.message : String(error); }
  finally {
    await context.close();
    await save(`performance-${profile.name}.json`, run);
    await save("performance-events.json", events);
  }
}

function findChrome(): string {
  if (process.env.QA_CHROME) return resolve(process.env.QA_CHROME);
  const candidates = [
    join(process.env.ProgramFiles ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    join(process.env.LOCALAPPDATA ?? "C:\\Users\\REDMI\\AppData\\Local", "Google", "Chrome", "Application", "chrome.exe"),
  ];
  const installed = candidates.find(existsSync);
  if (!installed) throw new Error("System Chrome not found. Set QA_CHROME to an existing executable; no browser will be installed.");
  return installed;
}

async function main(): Promise<void> {
  await mkdir(out, { recursive: true });
  let browser: Browser | undefined, fatal: string | undefined;
  let browserInfo: { executablePath: string; version?: string; headless: boolean } | undefined;
  let warmupMs: number | undefined, durationMs: number | undefined;
  try {
    warmupMs = seconds("QA_WARMUP_SECONDS", 15); durationMs = seconds("QA_SAMPLE_SECONDS", 20);
    const { chromium } = await import("playwright");
    const executablePath = findChrome();
    if (!existsSync(executablePath)) throw new Error(`No Chrome at ${executablePath}`);
    browserInfo = { executablePath, headless: process.env.QA_HEADLESS === "1" };
    browser = await chromium.launch({ executablePath, headless: browserInfo.headless });
    browserInfo.version = browser.version();
    // Serial profiles: parallel browsers/tabs would compete for CPU/GPU and skew FPS.
    for (const profile of profiles) await runProfile(browser, profile, warmupMs, durationMs);
  } catch (error) { fatal = error instanceof Error ? error.stack ?? error.message : String(error); }
  finally {
    try { await browser?.close(); } catch (error) { fatal ??= String(error); }
    const phases = runs.flatMap((run) => run.phases);
    const runtimeErrors = events.filter((e) => ["pageerror", "console:error", "requestfailed", "http-error"].includes(e.kind));
    const clsChecks = runs.map((run) => ({ profile: run.profile.name, cls: run.vitals?.cls ?? null,
      passed: run.vitals?.cls == null ? null : run.vitals.cls < 0.05 }));
    const incomplete = !!fatal || runs.length !== profiles.length || runs.some((run) => !!run.fatal || !run.cpuThrottleApplied
      || run.phases.length !== 4 || run.vitals?.fcpMs == null || run.vitals.lastObservedLcpMs == null
      || run.vitals.observerErrors.length > 0 || !run.vitals.supported.includes("longtask"))
      || phases.some((phase) => !phase.adequate) || clsChecks.some((check) => check.passed === null);
    const failed = phases.some((phase) => phase.proxyGoalPassed === false) || clsChecks.some((check) => check.passed === false) || runtimeErrors.length > 0;
    const status = fatal ? "error" : failed ? "failed" : incomplete ? "incomplete" : "raf-proxy-checks-passed-gpu-fps-unverified";
    const summary = {
      status, startedAt, finishedAt: new Date().toISOString(), url, out, browser: browserInfo, fatal,
      configuration: { warmupMs, durationMs, profiles },
      method: {
        fps: "Real in-page requestAnimationFrame intervals, stationary scroll checkpoints, no capture during measurement. RAF callback/main-thread scheduling throughput only; not guaranteed GPU-rendered or presented FPS.",
        statistics: "median/p10 of per-interval 1000/delta; throughput=count/wall-clock window; slowFrameShare=delta>1000/goal; >50ms share separate. Raw intervals retained. Warmup excluded. First/last 5s windows reported.",
        proxyPass: "Valid live-WebGL sample with >60 intervals, median + whole-window throughput + last-5s throughput >= profile goal. p10/slow-frame shares are diagnostics, not waived GPU assertions.",
        quality: "At least 15s per-phase warmup, observable canvas backing-size/data-qa-quality stability for final 5s warmup and full sample. Internal adaptive quality cannot be certified without an app API; exposed quality may be null.",
        cls: "Buffered layout-shift observer from before app startup. Maximum session-window sum (<1s gap, <5s window), excluding hadRecentInput; raw excluded/included entries retained. Goal <0.05. Missing observer is null, never zero.",
        lcp: "Last buffered largest-contentful-paint entry, provisional lab observation (not a finalized field Web Vital). loadVitals after hero and final whole-journey vitals both retained.",
        mobile: "390x844 CSS viewport, touch/isMobile, DPR 1, CDP CPU rate 4 applied before navigation; GPU/network unthrottled. Not equivalent to an actual mobile GPU.",
        hardware: "WEBGL_debug_renderer_info on captured existing APP context only. No extra GL canvas or fresh getContext probe. not-obviously-software is not proof of hardware acceleration.",
      },
      goals: {
        desktopRafProxyFps: 55, mobileRafProxyFps: 30, clsMax: 0.05,
        allRafProxyGoalsPassed: incomplete ? null : phases.every((phase) => phase.proxyGoalPassed === true),
        cls: clsChecks, runtimeErrors: runtimeErrors.length,
        actualGpuPresentedFps: { status: "not-measured", passed: null },
      },
      hiddenTabPause: { status: "not-tested", reason: "No dedicated app scene render-loop counter/API; RAF browser throttling or DOM visibility cannot prove app rendering pauses." },
      lighthouse: { status: existsSync(join(process.cwd(), "node_modules", "lighthouse", "cli", "index.js")) ? "available-not-run" : "unavailable", score: null, reason: "No dependency installation or inferred Lighthouse score; this harness does not run Lighthouse." },
      tracing: { status: "not-run", reason: "No FramePresented/DrawFrame trace; RAF is explicitly a proxy and trace overhead is avoided." },
      runs, events,
    };
    await save("performance-events.json", events);
    await save("performance-summary.json", summary);
    process.exitCode = fatal ? 2 : failed || incomplete ? 1 : 0;
    console.log(`Performance QA: ${status}; ${join(out, "performance-summary.json")}`);
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 2; });
