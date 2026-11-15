import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import type { WorldState } from "../src/scene/timeline";
// URL imports let Node load .ts directly without changing the app's compiler.
const { projects }: typeof import("../src/content/projects") = await import(new URL("../src/content/projects.ts", import.meta.url).href);
const { calibrateTimeline, sampleTimeline, timeline }: typeof import("../src/scene/timeline") = await import(new URL("../src/scene/timeline.ts", import.meta.url).href);

// Compare actual historical values, not a second hand-maintained fixture.
const original = execFileSync("git", ["show", "main:src/data/projects.ts"], { encoding: "utf8" });
const compiled = ts.transpileModule(original, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports: Record<string, unknown> = {};
new Function("exports", compiled)(exports);
const originals = Object.values(exports).filter(Array.isArray).flat() as Array<(typeof projects)[number]>;
let matched = 0;
for (const project of originals) {
  const current = projects.find((p) => p.title === project.title);
  assert.ok(current, project.title);
  assert.equal(current.description, project.description, project.title);
  assert.deepEqual(current.tech, project.tech, project.title);
  assert.equal(current.href, project.href, project.title);
  matched++;
}
assert.equal(matched, 15);

function checkContinuity() {
  for (let i = 0; i <= 10000; i++) {
    const sample = sampleTimeline(i / 10000, {} as WorldState);
    for (const value of Object.values(sample)) assert.ok(Number.isFinite(value));
  }
  for (const key of timeline.slice(1, -1)) {
    const a = sampleTimeline(key.at - 1e-6, {} as WorldState);
    const b = sampleTimeline(key.at + 1e-6, {} as WorldState);
    for (const field of Object.keys(a) as Array<keyof WorldState>) assert.ok(Math.abs(a[field] - b[field]) < 1e-5, field);
  }
}
checkContinuity();

// A short footer on a tall display previously produced TWO keys at 1, making
// the final state unreachable. Also cover the longer mobile project list.
for (const profile of [
  { height: 1080, document: 6000, tops: { stack: 1080, projects: 1850, garden: 4700, colophon: 5400 } },
  { height: 844, document: 10000, tops: { stack: 844, projects: 1500, garden: 8200, colophon: 9510 } },
]) {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { innerHeight: profile.height, scrollY: 0 } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    documentElement: { scrollHeight: profile.document },
    getElementById: (id: keyof typeof profile.tops) => ({ getBoundingClientRect: () => ({ top: profile.tops[id] }) }),
  } });
  calibrateTimeline();
  for (let i = 1; i < timeline.length; i++) assert.ok(timeline[i].at > timeline[i - 1].at, "strictly increasing keys");
  const last = sampleTimeline(1, {} as WorldState);
  for (const field of Object.keys(last) as Array<keyof WorldState>) assert.ok(Math.abs(last[field] - timeline.at(-1)!.state[field]) < 1e-12, `reachable final ${field}`);
  checkContinuity();
}
console.log("15 original projects exact; finite/continuous timeline; short-footer and mobile calibration passed.");
