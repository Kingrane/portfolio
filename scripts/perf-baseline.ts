/** Serial production measurements. PERF_TRACE=1 repeats motion scenarios with tracing instead. */
import { mkdir, open, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import type { CDPSession, Page } from "playwright";
import { launch, profiles, ready, resultPath, save, scrollTo, url, output, type PerfWindow } from "./perf/common.ts";

const tracing = process.env.PERF_TRACE === "1";
const selected = process.env.PERF_PROFILES?.split(",");
const runs: unknown[] = [];

function distribution(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (p: number) => {
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * p;
    return sorted[Math.floor(position)] + (sorted[Math.ceil(position)] - sorted[Math.floor(position)]) * (position % 1);
  };
  return { count: sorted.length, mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null,
    p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: sorted.at(-1) ?? null,
    over25: sorted.filter((ms) => ms > 25).length, over50: sorted.filter((ms) => ms > 50).length };
}

async function scenario(page: Page, mode: "scroll" | "pointer" | "idle", seconds: number, name: string) {
  const measurement = await page.evaluate(({ mode, seconds, name }) => new Promise<{ start: number; end: number; driverFrames: number }>((resolve) => {
    (window as PerfWindow).__portfolioPerf.reset();
    const start = performance.now(), duration = seconds * 1000;
    performance.mark(`perf:${name}:start`);
    const max = document.documentElement.scrollHeight - innerHeight;
    let raf = 0, driverFrames = 0, previousTarget: Element | null = null;
    const tick = (now: number) => {
      driverFrames++;
      const elapsed = Math.min(duration, now - start);
      if (mode === "scroll") window.scrollTo({ top: max * elapsed / duration, behavior: "instant" });
      if (mode === "pointer") {
        const angle = elapsed / 3000 * Math.PI * 2;
        const x = innerWidth * 0.68 + Math.cos(angle) * innerHeight * 0.18;
        const y = innerHeight * 0.46 + Math.sin(angle) * innerHeight * 0.18;
        const target = document.elementFromPoint(x, y) ?? document.body;
        if (target !== previousTarget) {
          previousTarget?.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: target, clientX: x, clientY: y, pointerType: "mouse" }));
          target.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, relatedTarget: previousTarget, clientX: x, clientY: y, pointerType: "mouse" }));
          previousTarget = target;
        }
        target.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y, pointerType: "mouse" }));
      }
      if (elapsed < duration) raf = requestAnimationFrame(tick);
    };
    if (mode !== "idle") raf = requestAnimationFrame(tick);
    setTimeout(() => { cancelAnimationFrame(raf); performance.mark(`perf:${name}:end`); resolve({ start, end: performance.now(), driverFrames }); }, duration);
  }), { mode, seconds, name });
  await page.waitForTimeout(300); // let asynchronous GPU queries for the window resolve
  const raw = await page.evaluate(() => (window as PerfWindow).__portfolioPerf.stop());
  const frames = raw.data.frames.filter((frame) => frame.at >= measurement.start && frame.at < measurement.end);
  const cpu = raw.data.cpu.filter((sample) => sample.at >= measurement.start && sample.at < measurement.end);
  const gpu = raw.data.gpu.filter((sample) => sample.at >= measurement.start && sample.at < measurement.end);
  const sections: Record<string, unknown> = {};
  for (const section of ["hero", "stack", "projects", "garden", "footer"]) {
    const local = frames.filter((frame) => frame.section === section);
    const cpuLabels = [...new Set(cpu.filter((sample) => sample.section === section).map((sample) => sample.label))];
    const gpuLabels = [...new Set(gpu.filter((sample) => sample.section === section).map((sample) => sample.label))];
    sections[section] = {
      frames: local.length, intervals: distribution(local.flatMap((frame) => frame.interval === null ? [] : [frame.interval])),
      cpuFrame: distribution(local.map((frame) => frame.cpu)),
      gpuFrame: distribution(gpu.filter((sample) => sample.section === section && sample.label === "full-frame").map((sample) => sample.ms)),
      calls: distribution(local.map((frame) => frame.calls)), triangles: distribution(local.map((frame) => frame.triangles)),
      qualities: [...new Set(local.map((frame) => frame.quality))],
      cpu: Object.fromEntries(cpuLabels.map((label) => [label, distribution(cpu.filter((sample) => sample.section === section && sample.label === label).map((sample) => sample.ms))])),
      gpu: Object.fromEntries(gpuLabels.map((label) => [label, distribution(gpu.filter((sample) => sample.section === section && sample.label === label).map((sample) => sample.ms))])),
    };
  }
  const summary = { name, mode, seconds, window: measurement, snapshot: { ...raw, data: undefined },
    intervals: distribution(frames.flatMap((frame) => frame.interval === null ? [] : [frame.interval])),
    cpuFrame: distribution(frames.map((frame) => frame.cpu)),
    gpuFrame: distribution(gpu.filter((sample) => sample.label === "full-frame").map((sample) => sample.ms)),
    sections, frames: frames.length, qualities: [...new Set(frames.map((frame) => frame.quality))] };
  console.log(`${name}: frames=${frames.length}, interval p95=${summary.intervals.p95?.toFixed(2)}, CPU p95=${summary.cpuFrame.p95?.toFixed(2)}, GPU p95=${summary.gpuFrame.p95?.toFixed(2)}, q=${summary.qualities.join(",")}`);
  return { summary, raw: { window: measurement, frames, cpu, gpu } };
}

async function memory(page: Page, cdp: CDPSession, label: string, collect = false) {
  if (collect) await cdp.send("HeapProfiler.collectGarbage");
  const heap = await cdp.send("Runtime.getHeapUsage");
  const scene = await page.evaluate(() => (window as PerfWindow).__portfolioPerf.snapshot());
  return { label, heap, scene };
}

async function finishTrace(cdp: CDPSession, path: string) {
  const complete = new Promise<{ stream?: string; dataLossOccurred?: boolean }>((resolve) => cdp.once("Tracing.tracingComplete", resolve));
  await cdp.send("Tracing.end");
  const event = await complete;
  if (!event.stream) throw new Error("Chrome did not return a trace stream");
  const file = await open(path, "w");
  try {
    while (true) {
      const chunk = await cdp.send("IO.read", { handle: event.stream, size: 1024 * 1024 });
      await file.write(Buffer.from(chunk.data, chunk.base64Encoded ? "base64" : "utf8"));
      if (chunk.eof) break;
    }
  } finally { await file.close(); await cdp.send("IO.close", { handle: event.stream }); }
  return { path, dataLossOccurred: event.dataLossOccurred ?? false };
}

await mkdir(output, { recursive: true });
for (const profile of profiles.filter((item) => !selected || selected.includes(item.name))) {
  const browser = await launch(profile.headless);
  const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.mobile, hasTouch: profile.mobile, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const run: Record<string, unknown> = { profile, browser: browser.version(), startedAt: new Date().toISOString(), scenarios: [], errors };
  const scenarios: unknown[] = [];
  try {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
    await page.addInitScript(() => {
      const data: { fcp: number | null; lcp: number | null; longtasks: { start: number; duration: number }[]; shifts: { start: number; value: number; input: boolean }[] } = { fcp: null, lcp: null, longtasks: [], shifts: [] };
      Object.assign(window, { __perfLoad: data });
      for (const type of ["paint", "largest-contentful-paint", "longtask", "layout-shift"]) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === "first-contentful-paint") data.fcp = entry.startTime;
            if (entry.entryType === "largest-contentful-paint") data.lcp = entry.startTime;
            if (entry.entryType === "longtask") data.longtasks.push({ start: entry.startTime, duration: entry.duration });
            if (entry.entryType === "layout-shift") {
              const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
              data.shifts.push({ start: shift.startTime, value: shift.value, input: shift.hadRecentInput });
            }
          }
        });
        observer.observe({ type, buffered: true });
      }
    });
    const address = new URL(url); address.searchParams.set("perf", "");
    await page.goto(address.href, { waitUntil: "load" });
    await ready(page);
    run.initial = await page.evaluate(() => {
      const host = window as unknown as Window & { __perfLoad: { fcp: number | null; lcp: number | null } };
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      return { ...host.__perfLoad, scripts: resources.filter((entry) => entry.initiatorType === "script").map((entry) => ({ name: entry.name, start: entry.startTime, end: entry.responseEnd, bytes: entry.encodedBodySize })),
        navigation: performance.getEntriesByType("navigation")[0].toJSON(), scene: window.__portfolioPerf!.snapshot() };
    });
    // Warm every shader/resource before testing growth; no false leak from first use.
    for (const target of ["stack", "projects", "garden", "footer", "hero"]) { await scrollTo(page, target); await page.waitForTimeout(1200); }
    await page.waitForTimeout(15000);
    await page.mouse.move(-100, -100);
    if (tracing) {
      await cdp.send("HeapProfiler.startSampling", { samplingInterval: 65536 });
      await cdp.send("Tracing.start", { transferMode: "ReturnAsStream", categories: "-*,devtools.timeline,v8.execute,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,toplevel,blink.user_timing,disabled-by-default-v8.cpu_profiler,disabled-by-default-v8.cpu_profiler.hires,v8,gpu" });
    }
    await scrollTo(page, "hero"); await page.waitForTimeout(2000);
    for (const [name, mode, seconds, target] of [
      ["autoscroll", "scroll", 60, "hero"],
      ["hero-pointer", "pointer", 15, "hero"],
      ["garden-pointer", "pointer", 15, "garden"],
    ] as const) {
      await scrollTo(page, target); await page.waitForTimeout(2500);
      const result = await scenario(page, mode, seconds, name);
      scenarios.push(result.summary);
      await writeFile(resultPath(`${profile.name}-${tracing ? "trace-" : ""}${name}-raw.json.gz`), gzipSync(JSON.stringify(result.raw)));
    }
    if (tracing) {
      run.trace = await finishTrace(cdp, resultPath(`${profile.name}.trace.json`));
      const allocations = await cdp.send("HeapProfiler.stopSampling");
      await save(resultPath(`${profile.name}-allocations.json`), allocations);
    } else {
      for (const target of ["hero", "garden"]) {
        await scrollTo(page, target); await page.mouse.move(-100, -100); await page.waitForTimeout(3000);
        const result = await scenario(page, "idle", 15, `${target}-idle`);
        scenarios.push(result.summary);
      }
      // A real second tab, not a fabricated document.hidden property.
      const before = await page.evaluate(() => window.__portfolioPerf!.snapshot());
      const foreground = await context.newPage(); await foreground.goto("about:blank"); await foreground.bringToFront();
      await foreground.waitForTimeout(5000);
      const hidden = await page.evaluate(() => window.__portfolioPerf!.snapshot());
      await page.bringToFront(); await page.waitForTimeout(2500);
      const restored = await page.evaluate(() => window.__portfolioPerf!.snapshot());
      await foreground.close();
      run.background = { before, hidden, restored, actuallyHidden: hidden.hidden, paused: hidden.hidden && hidden.frames - before.frames <= 2 };
      for (const target of ["stack", "projects", "footer"]) {
        await scrollTo(page, target); await page.waitForTimeout(3000);
        const result = await scenario(page, "idle", 10, `${target}-stationary`);
        scenarios.push(result.summary);
      }
      await scrollTo(page, "garden"); await page.waitForTimeout(3000);
      const memorySamples = [await memory(page, cdp, "warm-before", true)];
      for (let cycle = 1; cycle <= 5; cycle++) {
        await page.evaluate(() => new Promise<void>((resolve) => {
          const start = performance.now(), max = document.documentElement.scrollHeight - innerHeight;
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / 5000);
            window.scrollTo({ top: max * (t < 0.5 ? t * 2 : (1 - t) * 2), behavior: "instant" });
            if (t < 1) requestAnimationFrame(tick); else resolve();
          };
          requestAnimationFrame(tick);
        }));
        await page.setViewportSize({ width: profile.viewport.width - 30 + cycle * 10, height: profile.viewport.height - 20 + cycle * 5 });
        await page.waitForTimeout(600);
        await page.setViewportSize(profile.viewport); await scrollTo(page, "garden"); await page.waitForTimeout(2000);
        memorySamples.push(await memory(page, cdp, `cycle-${cycle}`));
      }
      memorySamples.push(await memory(page, cdp, "after-GC", true));
      run.memory = memorySamples;
    }
    run.scenarios = scenarios;
    run.final = await page.evaluate(() => ({ scene: window.__portfolioPerf!.snapshot(), load: (window as unknown as Window & { __perfLoad: unknown }).__perfLoad }));
  } catch (error) {
    run.fatal = String(error); run.scenarios = scenarios; process.exitCode = 1;
  } finally {
    run.finishedAt = new Date().toISOString();
    runs.push(run);
    await save(resultPath(`${profile.name}-${tracing ? "traced" : "baseline"}.json`), run);
    await context.close(); await browser.close();
  }
}
await save(resultPath(tracing ? "traced-summary.json" : "baseline-summary.json"), { schema: 1, url, tracing,
  method: "RAF callback intervals (not presented FPS), CPU R3F inclusive callback/renderer submission timing; asynchronous EXT GPU samples (1/20 full, 1/20 per-pass), no nested queries. CPU4x does not throttle GPU. Headless cadence is not a 60Hz physical monitor.", runs });
